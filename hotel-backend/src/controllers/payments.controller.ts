import { Request, Response } from "express";
import prisma from "../services/prisma";
import { z } from "zod";

/* =====================================
      LOCAL STATUS (APP LEVEL)
===================================== */

/**
 * Here I define the payment statuses used in my app.
 * I keep it local to stay consistent even if Prisma enums change.
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
      HELPERS (MOST IMPORTANT)
===================================== */

/**
 * Here I calculate how much was already paid for a booking (ONLY completed payments).
 * I optionally exclude one payment ID, which is key when updating a payment.
 */
async function getCompletedPaidForBooking(
  bookingId: number,
  excludePaymentId?: number
) {
  const where: any = {
    bookingId,
    status: "completed",
  };

  if (excludePaymentId) {
    where.id = { not: excludePaymentId };
  }

  const result = await prisma.payment.aggregate({
    where,
    _sum: { amount: true },
  });

  return result._sum.amount ?? 0;
}

/* =====================================
      CONTROLLERS
===================================== */

// GET /api/payments
export const getAllPayments = async (req: Request, res: Response) => {
  try {
    // Optional filters (bookingId/status) from query params
    const { bookingId, status } = req.query;
    const where: any = {};

    if (bookingId && !isNaN(Number(bookingId))) where.bookingId = Number(bookingId);

    if (status && typeof status === "string") {
      const allowedStatuses: PaymentStatus[] = ["pending", "completed", "failed"];
      if (allowedStatuses.includes(status as PaymentStatus)) where.status = status;
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
    console.error("Error en getAllPayments:", error);
    return res.status(500).json({
      success: false,
      error: "Error fetching payments",
    });
  }
};

// GET /api/payments/:id
export const getPaymentById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: "Invalid payment ID" });

    const payment = await prisma.payment.findUnique({
      where: { id },
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
    console.error("Error en getPaymentById:", error);
    return res.status(500).json({ success: false, error: "Error fetching payment" });
  }
};


// POST /api/payments
export const createPayment = async (req: Request, res: Response) => {
  try {
    const parsed = createPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid data",
        details: parsed.error.flatten(),
      });
    }

    const data = parsed.data;

    const booking = await prisma.booking.findUnique({
      where: { id: data.bookingId },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: "Associated booking not found",
      });
    }

    // Prevent overpayment only when created as "completed"
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
    console.error("Error en createPayment:", error);
    return res.status(500).json({ success: false, error: "Error creating payment" });
  }
};

// PUT /api/payments/:id
export const updatePayment = async (req: Request, res: Response) => {
  try {
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

    const existing = await prisma.payment.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Payment not found" });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: existing.bookingId },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: "Associated booking not found",
      });
    }

    const nextAmount = parsed.data.amount ?? existing.amount;
    const nextStatus = (parsed.data.status ?? existing.status) as PaymentStatus;

    // Prevent overpayment on updates if status is completed
    if (nextStatus === "completed") {
      const alreadyPaid = await getCompletedPaidForBooking(existing.bookingId, existing.id);
      const newTotalPaid = alreadyPaid + nextAmount;

      if (newTotalPaid > booking.totalPrice) {
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
    console.error("Error en updatePayment:", error);
    return res.status(500).json({ success: false, error: "Error updating payment" });
  }
};

// DELETE /api/payments/:id
export const deletePayment = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: "Invalid payment ID" });
    }

    await prisma.payment.delete({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Payment deleted successfully",
    });
  } catch (error: any) {
    console.error("Error en deletePayment:", error);

    if (error.code === "P2025") {
      return res.status(404).json({ success: false, error: "Payment not found" });
    }

    return res.status(500).json({ success: false, error: "Error deleting payment" });
  }
};
