import type { Response } from "express";
import prisma from "../services/prisma";
import { z } from "zod";
import type { AuthRequest } from "../middlewares/authMiddleware";
import { Prisma } from "@prisma/client";
import { auditLog } from "../services/audit.service";

/**
 * Here I validate payload for creating a charge.
 * I keep amounts as integers (UYU) to avoid floating rounding issues.
 */
const createChargeSchema = z.object({
  bookingId: z.preprocess((v) => Number(v), z.number().int().positive()),
  category: z.enum(["minibar", "service", "laundry", "other"]).optional(),
  description: z.string().min(1, "Description is required"),
  qty: z
    .preprocess((v) => (v == null || v === "" ? 1 : Number(v)), z.number().int().positive())
    .optional(),
  unitPrice: z.preprocess((v) => Number(v), z.number().int().nonnegative()),
});

/**
 * Update schema:
 * - bookingId is NOT allowed to change (safer)
 * - total is computed server-side
 */
const updateChargeSchema = z.object({
  category: z.enum(["minibar", "service", "laundry", "other"]).optional(),
  description: z.string().min(1).optional(),
  qty: z.preprocess((v) => (v == null || v === "" ? undefined : Number(v)), z.number().int().positive()).optional(),
  unitPrice: z.preprocess((v) => (v == null || v === "" ? undefined : Number(v)), z.number().int().nonnegative()).optional(),
});

/**
 * GET /api/charges
 * Here I list charges for the current hotel, optionally filtered by bookingId/roomId/date range.
 */
export const getAllCharges = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const { bookingId, roomId, from, to } = req.query;

    const where: Prisma.ChargeWhereInput = { hotelId };

    if (bookingId && !isNaN(Number(bookingId))) where.bookingId = Number(bookingId);
    if (roomId && !isNaN(Number(roomId))) where.roomId = Number(roomId);

    if (from && typeof from === "string") {
      const d = new Date(from);
      if (!isNaN(d.getTime())) where.createdAt = { ...(where.createdAt as any), gte: d };
    }
    if (to && typeof to === "string") {
      const d = new Date(to);
      if (!isNaN(d.getTime())) where.createdAt = { ...(where.createdAt as any), lte: d };
    }

    const charges = await prisma.charge.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        room: { select: { id: true, number: true, floor: true } },
        booking: { select: { id: true, status: true, checkIn: true, checkOut: true } },
        createdBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    return res.status(200).json({ success: true, data: charges });
  } catch (error) {
    console.error("Error in getAllCharges:", error);
    return res.status(500).json({ success: false, error: "Error fetching charges" });
  }
};

/**
 * POST /api/charges
 * Here I create a charge for the current hotel.
 * Important: I verify that booking belongs to the same hotel.
 */
export const createCharge = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    const createdById = req.user?.id ?? null;

    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const parsed = createChargeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        error: "Invalid data",
        details: parsed.error.flatten(),
      });
    }

    const data = parsed.data;

    // Tenant isolation: booking must belong to this hotel
    const booking = await prisma.booking.findFirst({
      where: { id: data.bookingId, hotelId },
      include: { room: true },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        code: "BOOKING_NOT_FOUND",
        error: "Booking not found",
      });
    }

    // Prevent adding charges to cancelled bookings
    if (booking.status === "cancelled") {
      return res.status(400).json({
        success: false,
        code: "BOOKING_CANCELLED",
        error: "I can’t add charges to a cancelled booking.",
      });
    }

    // Optional stricter rule: block adding charges after check-out
    if (booking.status === "checked_out") {
      return res.status(400).json({
        success: false,
        code: "BOOKING_CHECKED_OUT",
        error: "I can’t add charges to a checked-out booking.",
      });
    }

    const qty = data.qty ?? 1;
    const unitPrice = data.unitPrice;
    const total = qty * unitPrice;

    const charge = await prisma.charge.create({
      data: {
        hotelId,
        bookingId: booking.id,
        roomId: booking.roomId,
        createdById,
        category: (data.category ?? "other") as any,
        description: data.description,
        qty,
        unitPrice,
        total,
      },
      include: {
        room: { select: { id: true, number: true, floor: true } },
        booking: { select: { id: true, status: true } },
        createdBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    await auditLog({
      req,
      hotelId,
      actorUserId: createdById,
      action: "CHARGE_CREATED",
      entityType: "Charge",
      entityId: charge.id,
      metadata: {
        bookingId: charge.bookingId,
        roomId: charge.roomId,
        category: charge.category,
        description: charge.description,
        qty: charge.qty,
        unitPrice: charge.unitPrice,
        total: charge.total,
      },
    });

    return res.status(201).json({ success: true, data: charge });
  } catch (error) {
    console.error("Error in createCharge:", error);
    return res.status(500).json({ success: false, error: "Error creating charge" });
  }
};

/**
 * PUT /api/charges/:id
 * Here I update a charge only inside the current hotel.
 * - bookingId cannot change (safer)
 * - total is recalculated server-side
 */
export const updateCharge = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    const actorUserId = req.user?.id ?? null;

    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const id = Number(req.params.id);
    if (Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: "Invalid charge ID" });
    }

    const parsed = updateChargeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        error: "Invalid data",
        details: parsed.error.flatten(),
      });
    }

    const existing = await prisma.charge.findFirst({
      where: { id, hotelId },
      include: {
        booking: { select: { id: true, status: true } },
      },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "Charge not found" });
    }

    // Block editing charges from cancelled bookings
    if (existing.booking?.status === "cancelled") {
      return res.status(400).json({
        success: false,
        code: "BOOKING_CANCELLED",
        error: "I can’t edit charges from a cancelled booking.",
      });
    }

    // Optional stricter rule: block editing after check-out
    if (existing.booking?.status === "checked_out") {
      return res.status(400).json({
        success: false,
        code: "BOOKING_CHECKED_OUT",
        error: "I can’t edit charges from a checked-out booking.",
      });
    }

    const nextQty = parsed.data.qty ?? existing.qty;
    const nextUnitPrice = parsed.data.unitPrice ?? existing.unitPrice;
    const nextTotal = nextQty * nextUnitPrice;

    const updated = await prisma.charge.update({
      where: { id: existing.id },
      data: {
        category: parsed.data.category ?? existing.category,
        description: parsed.data.description ?? existing.description,
        qty: nextQty,
        unitPrice: nextUnitPrice,
        total: nextTotal,
      },
      include: {
        room: { select: { id: true, number: true, floor: true } },
        booking: { select: { id: true, status: true } },
        createdBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    await auditLog({
      req,
      hotelId,
      actorUserId,
      action: "CHARGE_UPDATED",
      entityType: "Charge",
      entityId: updated.id,
      metadata: {
        bookingId: updated.bookingId,
        before: {
          category: existing.category,
          description: existing.description,
          qty: existing.qty,
          unitPrice: existing.unitPrice,
          total: existing.total,
        },
        after: {
          category: updated.category,
          description: updated.description,
          qty: updated.qty,
          unitPrice: updated.unitPrice,
          total: updated.total,
        },
      },
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Error in updateCharge:", error);
    return res.status(500).json({ success: false, error: "Error updating charge" });
  }
};

/**
 * DELETE /api/charges/:id
 * Here I delete a charge only inside the current hotel.
 * (Route-level restriction: admin only)
 */
export const deleteCharge = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    const actorUserId = req.user?.id ?? null;

    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const id = Number(req.params.id);
    if (Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: "Invalid charge ID" });
    }

    const existing = await prisma.charge.findFirst({
      where: { id, hotelId },
      include: { booking: { select: { id: true, status: true } } },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "Charge not found" });
    }

    // Optional stricter rule: block deleting charges after check-out
    if (existing.booking?.status === "checked_out") {
      return res.status(400).json({
        success: false,
        code: "BOOKING_CHECKED_OUT",
        error: "I can’t delete charges from a checked-out booking.",
      });
    }

    await prisma.charge.delete({ where: { id: existing.id } });

    await auditLog({
      req,
      hotelId,
      actorUserId,
      action: "CHARGE_DELETED",
      entityType: "Charge",
      entityId: existing.id,
      metadata: {
        bookingId: existing.bookingId,
        roomId: existing.roomId,
        category: existing.category,
        description: existing.description,
        qty: existing.qty,
        unitPrice: existing.unitPrice,
        total: existing.total,
      },
    });

    return res.status(200).json({ success: true, message: "Charge deleted successfully" });
  } catch (error) {
    console.error("Error in deleteCharge:", error);
    return res.status(500).json({ success: false, error: "Error deleting charge" });
  }
};
