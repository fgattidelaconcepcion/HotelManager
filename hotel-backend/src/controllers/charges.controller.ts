import type { Response } from "express";
import prisma from "../services/prisma";
import { z } from "zod";
import type { AuthRequest } from "../middlewares/authMiddleware";
import { Prisma } from "@prisma/client";

/**
 * Here I validate payload for creating a charge.
 * I keep amounts as integers (UYU) to avoid floating rounding issues.
 */
const createChargeSchema = z.object({
  bookingId: z.preprocess((v) => Number(v), z.number().int().positive()),
  category: z.enum(["minibar", "service", "laundry", "other"]).optional(),
  description: z.string().min(1, "Description is required"),
  qty: z.preprocess((v) => (v == null || v === "" ? 1 : Number(v)), z.number().int().positive()).optional(),
  unitPrice: z.preprocess((v) => Number(v), z.number().int().nonnegative()),
});

/**
 * GET /api/charges
 * Here I list charges for the current hotel, optionally filtered by bookingId/roomId/date range.
 */
export const getAllCharges = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) return res.status(401).json({ success: false, error: "Missing hotel context" });

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
    const createdById = req.user?.id;

    if (!hotelId) return res.status(401).json({ success: false, error: "Missing hotel context" });

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

    // Here I load the booking and enforce tenant isolation.
    const booking = await prisma.booking.findFirst({
      where: { id: data.bookingId, hotelId },
      include: { room: true },
    });

    if (!booking) {
      return res.status(404).json({ success: false, code: "BOOKING_NOT_FOUND", error: "Booking not found" });
    }

    // Here I prevent adding charges to cancelled bookings.
    if (booking.status === "cancelled") {
      return res.status(400).json({
        success: false,
        code: "BOOKING_CANCELLED",
        error: "I can’t add charges to a cancelled booking.",
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
        createdById: createdById ?? null,
        category: (data.category ?? "other") as any,
        description: data.description,
        qty,
        unitPrice,
        total,
      },
      include: {
        room: { select: { id: true, number: true, floor: true } },
        booking: { select: { id: true, status: true } },
      },
    });

    return res.status(201).json({ success: true, data: charge });
  } catch (error) {
    console.error("Error in createCharge:", error);
    return res.status(500).json({ success: false, error: "Error creating charge" });
  }
};

/**
 * DELETE /api/charges/:id
 * Here I delete a charge only inside the current hotel.
 * (You can restrict this to admin only at route level if you want.)
 */
export const deleteCharge = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) return res.status(401).json({ success: false, error: "Missing hotel context" });

    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: "Invalid charge ID" });

    const existing = await prisma.charge.findFirst({
      where: { id, hotelId },
      select: { id: true },
    });

    if (!existing) return res.status(404).json({ success: false, error: "Charge not found" });

    await prisma.charge.delete({ where: { id } });

    return res.status(200).json({ success: true, message: "Charge deleted successfully" });
  } catch (error) {
    console.error("Error in deleteCharge:", error);
    return res.status(500).json({ success: false, error: "Error deleting charge" });
  }
};
