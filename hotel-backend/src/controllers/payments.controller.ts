import { Request, Response } from "express";
import prisma from "../services/prisma";
import { z } from "zod";
import { Prisma, BookingStatus } from "@prisma/client";

// ======================================
// Esquemas de validación
// ======================================

// Esquema para crear pago
const paymentSchema = z.object({
  bookingId: z.preprocess((v) => Number(v), z.number().int().positive()),
  amount: z.preprocess((v) => Number(v), z.number().positive()),
  method: z.enum(["cash", "card", "transfer"]).default("cash"),
  status: z.enum(["pending", "completed", "failed"]).default("pending"),
});

// Para actualizar, todos opcionales
const updatePaymentSchema = paymentSchema.partial();

// ======================================
// Helpers
// ======================================

/**
 * Recalcula el total pagado para una reserva y, si corresponde,
 * actualiza el estado de la Booking.
 *
 * Regla:
 * - Solo tocamos reservas en estado pending o confirmed.
 * - Si total pagado >= totalPrice  -> confirmed
 * - Si total pagado <  totalPrice  -> pending
 */
const syncBookingStatusWithPayments = async (bookingId: number) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payments: true },
  });

  if (!booking) return;

  const totalPaid = booking.payments
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);

  if (
    booking.status !== BookingStatus.pending &&
    booking.status !== BookingStatus.confirmed
  ) {
    // No modificamos otros estados (cancelled, checked_in, checked_out, etc.)
    return;
  }

  let newStatus: BookingStatus;
  if (totalPaid >= booking.totalPrice) {
    newStatus = BookingStatus.confirmed;
  } else {
    newStatus = BookingStatus.pending;
  }

  if (newStatus !== booking.status) {
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: newStatus },
    });
  }
};

/**
 * Obtiene una reserva con sus pagos y calcula el total pagado
 * (solo pagos con status = "completed").
 */
const getBookingWithTotals = async (bookingId: number) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payments: true },
  });

  if (!booking) return null;

  const totalPaid = booking.payments
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);

  return { booking, totalPaid };
};

// ======================================
// Controladores
// ======================================

/* ============================================================
   GET /api/payments
   Opcionalmente filtrado por bookingId y/o status
   ============================================================ */
export const getAllPayments = async (req: Request, res: Response) => {
  try {
    const { bookingId, status } = req.query;

    const where: Prisma.PaymentWhereInput = {};

    if (bookingId) {
      const id = Number(bookingId);
      if (!isNaN(id)) {
        where.bookingId = id;
      }
    }

    if (status && typeof status === "string") {
      where.status = status;
    }

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        booking: {
          include: {
            guest: true,
            room: {
              include: {
                roomType: true,
              },
            },
          },
        },
      },
    });

    return res.json({
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

/* ============================================================
   GET /api/payments/:id
   ============================================================ */
export const getPaymentById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: "ID inválido",
      });
    }

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            guest: true,
            room: {
              include: {
                roomType: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: "Pago no encontrado",
      });
    }

    return res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.error("Error en getPaymentById:", error);
    return res.status(500).json({
      success: false,
      error: "Error al obtener pago",
    });
  }
};

/* ============================================================
   POST /api/payments
   Crea un pago y, si corresponde, actualiza estado de la reserva
   y bloquea sobrepagos.
   ============================================================ */
export const createPayment = async (req: Request, res: Response) => {
  try {
    const parsed = paymentSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Datos inválidos",
        details: parsed.error.flatten(),
      });
    }

    const { bookingId, amount, method, status } = parsed.data;

    // Verificar que la reserva exista y calcular totales pagados
    const bookingTotals = await getBookingWithTotals(bookingId);
    if (!bookingTotals) {
      return res.status(404).json({
        success: false,
        error: "Reserva no encontrada",
      });
    }

    const { booking, totalPaid } = bookingTotals;

    // Si el pago nuevo es "completed", validamos que no supere el total
    if (status === "completed") {
      const newTotalPaid = totalPaid + amount;
      if (newTotalPaid > booking.totalPrice) {
        return res.status(400).json({
          success: false,
          error:
            "La reserva ya está completamente pagada o el monto supera el total de la reserva.",
        });
      }
    }

    const payment = await prisma.payment.create({
      data: {
        bookingId,
        amount,
        method,
        status,
      },
    });

    // Recalcular estado de la reserva en base a los pagos
    await syncBookingStatusWithPayments(bookingId);

    return res.status(201).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.error("Error en createPayment:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return res.status(400).json({
        success: false,
        error: "Error de base de datos al crear pago",
        code: error.code,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Error al crear pago",
    });
  }
};

/* ============================================================
   PUT /api/payments/:id
   Actualiza un pago y vuelve a sincronizar estado de la reserva.
   También evita sobrepagos.
   ============================================================ */
export const updatePayment = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: "ID inválido",
      });
    }

    const parsed = updatePaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Datos inválidos",
        details: parsed.error.flatten(),
      });
    }

    const data = parsed.data;

    const existing = await prisma.payment.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Pago no encontrado",
      });
    }

    const finalBookingId = data.bookingId ?? existing.bookingId;

    // Obtenemos la reserva con todos sus pagos
    const bookingTotals = await getBookingWithTotals(finalBookingId);
    if (!bookingTotals) {
      return res.status(404).json({
        success: false,
        error: "Reserva no encontrada",
      });
    }

    const { booking, totalPaid } = bookingTotals;

    // Calculamos el total pagado sin contar este pago
    const totalPaidExcludingCurrent =
      totalPaid -
      (existing.status === "completed" ? existing.amount : 0);

    const nextStatus = data.status ?? existing.status;
    const nextAmount = data.amount ?? existing.amount;

    if (nextStatus === "completed") {
      const newTotalPaid = totalPaidExcludingCurrent + nextAmount;
      if (newTotalPaid > booking.totalPrice) {
        return res.status(400).json({
          success: false,
          error:
            "La reserva ya está completamente pagada o el monto supera el total de la reserva.",
        });
      }
    }

    const updated = await prisma.payment.update({
      where: { id },
      data,
    });

    await syncBookingStatusWithPayments(finalBookingId);

    return res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Error en updatePayment:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return res.status(400).json({
        success: false,
        error: "Error de base de datos al actualizar pago",
        code: error.code,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Error al actualizar pago",
    });
  }
};

/* ============================================================
   DELETE /api/payments/:id
   Elimina un pago y vuelve a sincronizar la reserva.
   ============================================================ */
export const deletePayment = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: "ID inválido",
      });
    }

    const existing = await prisma.payment.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Pago no encontrado",
      });
    }

    const deleted = await prisma.payment.delete({
      where: { id },
    });

    // Recalcular el estado de la reserva después de eliminar el pago
    await syncBookingStatusWithPayments(existing.bookingId);

    return res.json({
      success: true,
      data: deleted,
    });
  } catch (error) {
    console.error("Error en deletePayment:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return res.status(404).json({
          success: false,
          error: "Pago no encontrado",
        });
      }
    }

    return res.status(500).json({
      success: false,
      error: "Error al eliminar pago",
    });
  }
};
