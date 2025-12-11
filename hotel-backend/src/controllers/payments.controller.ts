import { Request, Response } from "express";
import prisma from "../services/prisma";
import { z } from "zod";

/* =====================================
      STATUS LOCAL
===================================== */

// Enum de estados que usamos en la app
const paymentStatusEnum = z.enum(["pending", "completed", "failed"]);
type PaymentStatus = z.infer<typeof paymentStatusEnum>;

/* =====================================
      VALIDACIÓN ZOD
===================================== */

const basePaymentSchema = z.object({
  bookingId: z.preprocess((v) => Number(v), z.number().int().positive()),
  amount: z.preprocess((v) => Number(v), z.number().positive()),
  method: z.enum(["cash", "card", "transfer"]),
  status: paymentStatusEnum,
});

const createPaymentSchema = basePaymentSchema;
const updatePaymentSchema = basePaymentSchema.partial();

/* =====================================
      HELPERS
===================================== */

// Calcula el total pagado (pagos COMPLETADOS) para una reserva, excluyendo opcionalmente un pago
async function getCompletedPaidForBooking(
  bookingId: number,
  excludePaymentId?: number
) {
  const where: any = {
    bookingId,
    status: "completed", // usamos string directo, sin enum de Prisma
  };

  if (excludePaymentId) {
    where.id = { not: excludePaymentId };
  }

  const result = await prisma.payment.aggregate({
    where,
    _sum: {
      amount: true,
    },
  });

  return result._sum.amount ?? 0;
}

/* =====================================
      CONTROLADORES
===================================== */

// GET /api/payments
export const getAllPayments = async (req: Request, res: Response) => {
  try {
    const { bookingId, status } = req.query;

    const where: any = {};

    if (bookingId && !isNaN(Number(bookingId))) {
      where.bookingId = Number(bookingId);
    }

    if (status && typeof status === "string") {
      const allowedStatuses: PaymentStatus[] = [
        "pending",
        "completed",
        "failed",
      ];
      if (allowedStatuses.includes(status as PaymentStatus)) {
        where.status = status;
      }
    }

    const payments = await prisma.payment.findMany({
      where,
      orderBy: {
        createdAt: "desc",
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

    return res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (error) {
    console.error("Error en getAllPayments:", error);
    return res.status(500).json({
      success: false,
      error: "Error al obtener pagos",
    });
  }
};

// GET /api/payments/:id
export const getPaymentById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res
        .status(400)
        .json({ success: false, error: "ID de pago inválido" });
    }

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

    if (!payment) {
      return res
        .status(404)
        .json({ success: false, error: "Pago no encontrado" });
    }

    return res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.error("Error en getPaymentById:", error);
    return res.status(500).json({
      success: false,
      error: "Error al obtener el pago",
    });
  }
};

// POST /api/payments
export const createPayment = async (req: Request, res: Response) => {
  try {
    const parsed = createPaymentSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Datos inválidos",
        details: parsed.error.flatten(),
      });
    }

    const data = parsed.data;

    // 1) Verificar que la reserva exista
    const booking = await prisma.booking.findUnique({
      where: { id: data.bookingId },
    });

    if (!booking) {
      return res
        .status(404)
        .json({ success: false, error: "Reserva asociada no encontrada" });
    }

    // 2) Si el pago se marca como COMPLETED, validar sobrepago
    if (data.status === "completed") {
      const alreadyPaid = await getCompletedPaidForBooking(data.bookingId);
      const newTotalPaid = alreadyPaid + data.amount;

      if (newTotalPaid > booking.totalPrice) {
        return res.status(400).json({
          success: false,
          error:
            "El monto del pago supera el total de la reserva. No se puede registrar este pago.",
        });
      }
    }

    // 3) Crear el pago
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

    return res.status(201).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.error("Error en createPayment:", error);
    return res.status(500).json({
      success: false,
      error: "Error al crear el pago",
    });
  }
};

// PUT /api/payments/:id
export const updatePayment = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res
        .status(400)
        .json({ success: false, error: "ID de pago inválido" });
    }

    const parsed = updatePaymentSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Datos inválidos",
        details: parsed.error.flatten(),
      });
    }

    const existing = await prisma.payment.findUnique({
      where: { id },
    });

    if (!existing) {
      return res
        .status(404)
        .json({ success: false, error: "Pago no encontrado" });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: existing.bookingId },
    });

    if (!booking) {
      return res
        .status(404)
        .json({ success: false, error: "Reserva asociada no encontrada" });
    }

    // Nuevos valores (o actuales si no se cambiaron)
    const nextAmount = parsed.data.amount ?? existing.amount;
    const nextStatus = parsed.data.status ?? (existing.status as PaymentStatus);

    // Validar sobrepago SOLO si el nuevo estado queda como COMPLETED
    if (nextStatus === "completed") {
      // total de pagos completados EXCLUYENDO este pago
      const alreadyPaid = await getCompletedPaidForBooking(
        existing.bookingId,
        existing.id
      );

      const newTotalPaid = alreadyPaid + nextAmount;

      if (newTotalPaid > booking.totalPrice) {
        return res.status(400).json({
          success: false,
          error:
            "El monto total de pagos completados supera el total de la reserva. No se puede actualizar este pago.",
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

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Error en updatePayment:", error);
    return res.status(500).json({
      success: false,
      error: "Error al actualizar el pago",
    });
  }
};

// DELETE /api/payments/:id
export const deletePayment = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res
        .status(400)
        .json({ success: false, error: "ID de pago inválido" });
    }

    await prisma.payment.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: "Pago eliminado correctamente",
    });
  } catch (error: any) {
    console.error("Error en deletePayment:", error);

    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, error: "Pago no encontrado" });
    }

    return res.status(500).json({
      success: false,
      error: "Error al eliminar el pago",
    });
  }
};
