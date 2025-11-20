import { Request, Response } from "express";
import prisma from "../services/prisma";
import { z } from "zod";

/* =====================================
      VALIDACIÓN ZOD
===================================== */

const bookingSchema = z.object({
  userId: z.preprocess((v) => Number(v), z.number().int().positive()),
  guestId: z
    .preprocess(
      (v) => (v === undefined || v === null || v === "" ? undefined : Number(v)),
      z.number().int().positive()
    )
    .optional(),
  roomId: z.preprocess((v) => Number(v), z.number().int().positive()),
  checkIn: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: "Fecha de check-in inválida",
  }),
  checkOut: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: "Fecha de check-out inválida",
  }),
});

const updateBookingSchema = z.object({
  checkIn: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: "Fecha de check-in inválida",
  }),
  checkOut: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: "Fecha de check-out inválida",
  }),
});

const statusSchema = z.object({
  status: z.enum(["pending", "confirmed", "cancelled", "checked_in", "checked_out"]),
});

/* =====================================
         OBTENER TODAS
===================================== */

export const getAllBookings = async (_req: Request, res: Response) => {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        user: true,
        guest: true,
        room: { include: { roomType: true } },
      },
      orderBy: { id: "desc" },
    });

    return res.status(200).json({ success: true, bookings });
  } catch (error) {
    console.error("Error obteniendo reservas:", error);
    return res
      .status(500)
      .json({ success: false, error: "Error al obtener reservas" });
  }
};

/* =====================================
           OBTENER POR ID
===================================== */

export const getBookingById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id))
      return res.status(400).json({ success: false, error: "ID inválido" });

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        user: true,
        guest: true,
        room: { include: { roomType: true } },
      },
    });

    if (!booking)
      return res
        .status(404)
        .json({ success: false, error: "Reserva no encontrada" });

    return res.status(200).json({ success: true, booking });
  } catch (error) {
    console.error("Error en getBookingById:", error);
    return res.status(500).json({ success: false, error: "Error interno" });
  }
};

/* =====================================
           CREAR RESERVA
===================================== */

export const createBooking = async (req: Request, res: Response) => {
  try {
    const parsed = bookingSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Datos inválidos",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { userId, guestId, roomId, checkIn, checkOut } = parsed.data;

    // Verificar disponibilidad
    const overlappingBooking = await prisma.booking.findFirst({
      where: {
        roomId,
        checkIn: { lte: new Date(checkOut) },
        checkOut: { gte: new Date(checkIn) },
      },
    });

    if (overlappingBooking) {
      return res.status(400).json({
        success: false,
        error: "La habitación no está disponible en esas fechas",
      });
    }

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { roomType: true },
    });

    if (!room)
      return res
        .status(404)
        .json({ success: false, error: "Habitación no encontrada" });

    // Calcular noches
    const nights = Math.max(
      1,
      Math.ceil(
        (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000
      )
    );

    const totalPrice = room.roomType.basePrice * nights;

    const booking = await prisma.booking.create({
      data: {
        userId,
        guestId: guestId ?? null,
        roomId,
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        totalPrice,
      },
    });

    // Marcar la habitación como ocupada
    await prisma.room.update({
      where: { id: roomId },
      data: { status: "ocupado" },
    });

    return res.status(201).json({
      success: true,
      message: "Reserva creada correctamente",
      booking,
    });
  } catch (error) {
    console.error("Error creando reserva:", error);
    return res.status(500).json({
      success: false,
      error: "Error al crear reserva",
    });
  }
};

/* =====================================
           ACTUALIZAR FECHAS
===================================== */

export const updateBooking = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id))
      return res.status(400).json({ success: false, error: "ID inválido" });

    const parsed = updateBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Datos inválidos",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { checkIn, checkOut } = parsed.data;

    const booking = await prisma.booking.update({
      where: { id },
      data: {
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Reserva actualizada correctamente",
      booking,
    });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, error: "Reserva no encontrada" });
    }

    return res.status(500).json({
      success: false,
      error: "Error al actualizar la reserva",
    });
  }
};

/* =====================================
           ACTUALIZAR ESTADO
===================================== */

export const updateBookingStatus = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id))
      return res.status(400).json({ success: false, error: "ID inválido" });

    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Estado inválido",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { status } = parsed.data;

    const booking = await prisma.booking.update({
      where: { id },
      data: { status },
    });

    // Cambios de estado y habitaciones
    if (status === "cancelled" || status === "checked_out") {
      await prisma.room.update({
        where: { id: booking.roomId },
        data: { status: "disponible" },
      });
    }

    if (status === "checked_in") {
      await prisma.room.update({
        where: { id: booking.roomId },
        data: { status: "ocupado" },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Estado actualizado",
      booking,
    });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, error: "Reserva no encontrada" });
    }

    return res.status(500).json({
      success: false,
      error: "Error al actualizar estado",
    });
  }
};

/* =====================================
            ELIMINAR RESERVA
===================================== */

export const deleteBooking = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id))
      return res.status(400).json({ success: false, error: "ID inválido" });

    const booking = await prisma.booking.delete({
      where: { id },
    });

    await prisma.room.update({
      where: { id: booking.roomId },
      data: { status: "disponible" },
    });

    return res.status(200).json({
      success: true,
      message: "Reserva eliminada correctamente",
    });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, error: "Reserva no encontrada" });
    }

    return res.status(500).json({
      success: false,
      error: "Error al eliminar la reserva",
    });
  }
};
