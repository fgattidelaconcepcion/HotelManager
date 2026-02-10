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

/**
 *   Here I calculate the charges total for a booking.
 * Charges live in their own table, so I sum Charge.total for this booking.
 */
async function getChargesTotalForBooking(bookingId: number) {
  const result = await prisma.charge.aggregate({
    where: { bookingId },
    _sum: { total: true },
  });

  return result._sum.total ?? 0;
}

/**
 *  Here I compute a "grand total" for a booking:
 * - roomTotal comes from Booking.totalPrice (Float)
 * - chargesTotal comes from Charge.total (Int)
 *
 * I round the room total to keep currency consistent (your UI shows 0 decimals).
 * If later you want decimals, we can switch to cents everywhere.
 */
function computeGrandTotal(roomTotal: number, chargesTotal: number) {
  const safeRoomTotal = Math.round(roomTotal ?? 0);
  const safeChargesTotal = Math.round(chargesTotal ?? 0);
  return safeRoomTotal + safeChargesTotal;
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

/**
 * NEW: GET /api/payments/booking/:bookingId/summary
 * Here I return a clean financial summary for one reservation:
 * - roomTotal
 * - chargesTotal
 * - grandTotal
 * - paidCompleted
 * - dueAmount
 *
 * This lets the frontend show "pending" including charges.
 */
export const getBookingPaymentSummary = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const bookingId = Number(req.params.bookingId);
    if (Number.isNaN(bookingId) || bookingId <= 0) {
      return res.status(400).json({ success: false, error: "Invalid booking ID" });
    }

    // Here I verify the booking belongs to this hotel
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, hotelId },
      select: { id: true, totalPrice: true },
    });

    if (!booking) {
      return res.status(404).json({ success: false, error: "Booking not found in this hotel" });
    }

    const chargesTotal = await getChargesTotalForBooking(bookingId);
    const paidCompleted = await getCompletedPaidForBooking(bookingId);

    const roomTotal = Math.round(booking.totalPrice ?? 0);
    const grandTotal = computeGrandTotal(booking.totalPrice ?? 0, chargesTotal);

    const dueAmount = Math.max(grandTotal - paidCompleted, 0);

    return res.status(200).json({
      success: true,
      data: {
        bookingId,
        roomTotal,
        chargesTotal,
        grandTotal,
        paidCompleted,
        dueAmount,
      },
    });
  } catch (error) {
    console.error("Error in getBookingPaymentSummary:", error);
    return res.status(500).json({ success: false, error: "Error fetching booking payment summary" });
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

    /**
     * Critical fix:
     * Here I include charges in the maximum payable amount.
     * Before: I compared against booking.totalPrice only (room total).
     * Now: I compare against grandTotal = roomTotal + chargesTotal.
     */
    const chargesTotal = await getChargesTotalForBooking(data.bookingId);
    const grandTotal = computeGrandTotal(booking.totalPrice ?? 0, chargesTotal);

    // Here I prevent overpayment only when created as "completed"
    if (data.status === "completed") {
      const alreadyPaid = await getCompletedPaidForBooking(data.bookingId);
      const newTotalPaid = alreadyPaid + data.amount;

      if (newTotalPaid > grandTotal) {
        return res.status(400).json({
          success: false,
          error: "This payment exceeds the reservation total (room + charges). Payment cannot be recorded.",
          details: { grandTotal, alreadyPaid, attempt: data.amount },
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

    /**
     * 
     * Here I include charges in the maximum payable amount for updates too.
     */
    const chargesTotal = await getChargesTotalForBooking(existing.bookingId);
    const grandTotal = computeGrandTotal(existing.booking.totalPrice ?? 0, chargesTotal);

    // Here I prevent overpayment on updates if status is completed
    if (nextStatus === "completed") {
      const alreadyPaid = await getCompletedPaidForBooking(existing.bookingId, existing.id);
      const newTotalPaid = alreadyPaid + nextAmount;

      if (newTotalPaid > grandTotal) {
        return res.status(400).json({
          success: false,
          error: "Completed payments would exceed the reservation total (room + charges). Update not allowed.",
          details: { grandTotal, alreadyPaid, attempt: nextAmount },
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
