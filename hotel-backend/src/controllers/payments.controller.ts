import { Request, Response } from "express";
import prisma from "../services/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";

// Esquema para crear pago
const paymentSchema = z.object({
  bookingId: z.preprocess((v) => Number(v), z.number().int().positive()),
  amount: z.preprocess((v) => Number(v), z.number().positive()),
  method: z.enum(["cash", "card", "transfer"]).default("cash"),
  status: z.enum(["pending", "completed", "failed"]).default("pending"),
});

// Para actualizar, todos opcionales
const updatePaymentSchema = paymentSchema.partial();

/* ============================================================
   GET /api/payments  (lista con filtros opcionales)
   ============================================================ */
export const getAllPayments = async (req: Request, res: Response) => {
  try {
    const { bookingId, status } = req.query;

    const where: Prisma.PaymentWhereInput = {};

    if (bookingId && !isNaN(Number(bookingId))) {
      where.bookingId = Number(bookingId);
    }

    if (status && typeof status === "string") {
      where.status = status;
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        booking: {
          include: {
            room: true,
            guest: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
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

/* ============================================================
   GET /api/payments/:id
   ============================================================ */
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
            room: true,
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
      error: "Error al obtener pago",
    });
  }
};

/* ============================================================
   POST /api/payments   (Crear pago)
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

    const data = parsed.data;

    // Verificar que la reserva exista
    const booking = await prisma.booking.findUnique({
      where: { id: data.bookingId },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: "Reserva asociada no encontrada",
      });
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
            room: true,
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
      error: "Error al crear pago",
    });
  }
};

/* ============================================================
   PUT /api/payments/:id   (Actualizar pago)
   ============================================================ */
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

    const data = parsed.data;

    const updated = await prisma.payment.update({
      where: { id },
      data: {
        bookingId:
          typeof data.bookingId === "number" && !isNaN(data.bookingId)
            ? data.bookingId
            : undefined,
        amount:
          typeof data.amount === "number" && !isNaN(data.amount)
            ? data.amount
            : undefined,
        method: data.method ?? undefined,
        status: data.status ?? undefined,
      },
      include: {
        booking: {
          include: {
            room: true,
            guest: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error: unknown) {
    console.error("Error en updatePayment:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return res.status(404).json({
        success: false,
        error: "Pago no encontrado",
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
   ============================================================ */
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
  } catch (error: unknown) {
    console.error("Error en deletePayment:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return res.status(404).json({
        success: false,
        error: "Pago no encontrado",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Error al eliminar pago",
    });
  }
};
