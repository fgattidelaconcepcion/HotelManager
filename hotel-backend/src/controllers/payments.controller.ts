import type { Response } from "express";
import prisma from "../services/prisma";
import { z } from "zod";
import type { AuthRequest } from "../middlewares/authMiddleware";

/* =====================================
      LOCAL STATUS (APP LEVEL)
===================================== */

/**
 * Here I define the payment statuses used in my app.
 * I keep it local to stay stable even if Prisma enums change later.
 */
const paymentStatusEnum = z.enum(["pending", "completed", "failed"]);
type PaymentStatus = z.infer<typeof paymentStatusEnum>;

/* =====================================
      ZOD VALIDATION (CORE)
===================================== */

const basePaymentSchema = z.object({
  // Here I coerce values coming from the client into numbers and validate them
  bookingId: z.preprocess((v) => Number(v), z.number().int().positive()),
  amount: z.preprocess((v) => Number(v), z.number().positive()),

  // Here I restrict allowed payment methods
  method: z.enum(["cash", "card", "transfer"]),

  // Here I enforce an allowed payment status
  status: paymentStatusEnum,
});

const createPaymentSchema = basePaymentSchema;
const updatePaymentSchema = basePaymentSchema.partial();

/* =====================================
      HELPERS
===================================== */

/**
 * Here I calculate how much was already paid for a booking (ONLY completed payments).
 * I DO NOT filter by hotelId directly because Payment does not have hotelId.
 * Instead, I validate the booking belongs to the hotel before calling this.
 */
async function getCompletedPaidForBooking(bookingId: number, excludePaymentId?: number) {
  const where: any = { bookingId, status: "completed" };
  if (excludePaymentId) where.id = { not: excludePaymentId };

  const result = await prisma.payment.aggregate({
    where,
    _sum: { amount: true },
  });

  return result._sum.amount ?? 0;
}

/* =====================================
      CONTROLLERS (MULTI-HOTEL SAFE)
===================================== */

// GET /api/payments
export const getAllPayments = async (req: AuthRequest, res: Response) => {
  try {
    // Here I enforce tenant isolation: I need hotelId from JWT
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const { bookingId, status } = req.query;

    /**
     * Here I scope payments by traversing the relation:
     * Payment -> Booking -> hotelId
     */
    const where: any = {
      booking: { hotelId },
    };

    if (bookingId && !isNaN(Number(bookingId))) {
      // Here I optionally filter by bookingId (still scoped by booking.hotelId)
      where.bookingId = Number(bookingId);
    }

    if (status && typeof status === "string") {
      const allowed: PaymentStatus[] = ["pending", "completed", "failed"];
      if (allowed.includes(status as PaymentStatus)) where.status = status;
    }

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        booking: {
          include: {
            room: { include: { roomType: true } },
            guest: true,
          },
        },
      },
    });

    return res.status(200).json({ success: true, data: payments });
  } catch (error) {
    console.error("Error in getAllPayments:", error);
    return res.status(500).json({ success: false, error: "Error fetching payments" });
  }
};

// GET /api/payments/:id
export const getPaymentById = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: "Invalid payment ID" });

    // Here I enforce tenant isolation through booking relation
    const payment = await prisma.payment.findFirst({
      where: { id, booking: { hotelId } },
      include: {
        booking: {
          include: {
            room: { include: { roomType: true } },
            guest: true,
          },
        },
      },
    });

    if (!payment) return res.status(404).json({ success: false, error: "Payment not found" });

    return res.status(200).json({ success: true, data: payment });
  } catch (error) {
    console.error("Error in getPaymentById:", error);
    return res.status(500).json({ success: false, error: "Error fetching payment" });
  }
};

// POST /api/payments
export const createPayment = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const parsed = createPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid data",
        details: parsed.error.flatten(),
      });
    }

    const data = parsed.data;

    // Here I make sure the booking exists AND belongs to this hotel
    const booking = await prisma.booking.findFirst({
      where: { id: data.bookingId, hotelId },
      select: { id: true, totalPrice: true },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: "Associated booking not found in this hotel",
      });
    }

    // Here I prevent overpayment only when created as "completed"
    if (data.status === "completed") {
      const alreadyPaid = await getCompletedPaidForBooking(data.bookingId);
      const newTotalPaid = alreadyPaid + data.amount;

      if (newTotalPaid > booking.totalPrice) {
        return res.status(400).json({
          success: false,
          error: "This payment exceeds the booking total. Payment cannot be recorded.",
        });
      }
    }

    // Here I create the payment (Payment does NOT store hotelId; hotel scope comes from booking)
    const payment = await prisma.payment.create({
      data: {
        bookingId: data.bookingId,
        amount: data.amount,
        method: data.method,
        status: data.status,
      },
      include: {
        booking: {
          include: {
            room: { include: { roomType: true } },
            guest: true,
          },
        },
      },
    });

    return res.status(201).json({ success: true, data: payment });
  } catch (error) {
    console.error("Error in createPayment:", error);
    return res.status(500).json({ success: false, error: "Error creating payment" });
  }
};

// PUT /api/payments/:id
export const updatePayment = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const id = Number(req.params.id);
    if (Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: "Invalid payment ID" });
    }

    const parsed = updatePaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid data",
        details: parsed.error.flatten(),
      });
    }

    // Here I only allow updating a payment that belongs to my hotel (via booking relation)
    const existing = await prisma.payment.findFirst({
      where: { id, booking: { hotelId } },
      include: { booking: { select: { id: true, totalPrice: true } } },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "Payment not found" });
    }

    const nextAmount = parsed.data.amount ?? existing.amount;
    const nextStatus = (parsed.data.status ?? existing.status) as PaymentStatus;

    // Here I prevent overpayment on updates if status is completed
    if (nextStatus === "completed") {
      const alreadyPaid = await getCompletedPaidForBooking(existing.bookingId, existing.id);
      const newTotalPaid = alreadyPaid + nextAmount;

      if (newTotalPaid > existing.booking.totalPrice) {
        return res.status(400).json({
          success: false,
          error: "Completed payments would exceed the booking total. Update not allowed.",
        });
      }
    }

    const updated = await prisma.payment.update({
      where: { id },
      data: {
        amount: parsed.data.amount ?? existing.amount,
        method: parsed.data.method ?? existing.method,
        status: parsed.data.status ?? existing.status,
      },
      include: {
        booking: {
          include: {
            room: { include: { roomType: true } },
            guest: true,
          },
        },
      },
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Error in updatePayment:", error);
    return res.status(500).json({ success: false, error: "Error updating payment" });
  }
};

// DELETE /api/payments/:id
export const deletePayment = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const id = Number(req.params.id);
    if (Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: "Invalid payment ID" });
    }

    // Here I enforce tenant isolation: I only delete payments inside my hotel
    const existing = await prisma.payment.findFirst({
      where: { id, booking: { hotelId } },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "Payment not found" });
    }

    await prisma.payment.delete({ where: { id } });

    return res.status(200).json({ success: true, message: "Payment deleted successfully" });
  } catch (error) {
    console.error("Error in deletePayment:", error);
    return res.status(500).json({ success: false, error: "Error deleting payment" });
  }
};
