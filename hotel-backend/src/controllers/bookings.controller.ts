import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

//  Esquema de validación para crear reserva
const bookingSchema = z.object({
  userId: z.number().int().positive({ message: "userId debe ser un número positivo" }),
  roomId: z.number().int().positive({ message: "roomId debe ser un número positivo" }),
  checkIn: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: "Fecha de check-in inválida" }),
  checkOut: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: "Fecha de check-out inválida" }),
});

//  Esquema para actualizar reserva
const updateBookingSchema = z.object({
  checkIn: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: "Fecha de check-in inválida" }),
  checkOut: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: "Fecha de check-out inválida" }),
});

//  Obtener todas las reservas
export const getAllBookings = async (_: Request, res: Response) => {
  try {
    const bookings = await prisma.booking.findMany({
      include: { user: true, room: { include: { roomType: true } } },
      orderBy: { id: "desc" },
    });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener reservas" });
  }
};

//  Crear una nueva reserva
export const createBooking = async (req: Request, res: Response) => {
  try {
    // Validar datos con Zod
    const parseResult = bookingSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Datos inválidos",
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { userId, roomId, checkIn, checkOut } = parseResult.data;

    // Verificar disponibilidad
    const overlappingBooking = await prisma.booking.findFirst({
      where: {
        roomId,
        checkIn: { lte: new Date(checkOut) },
        checkOut: { gte: new Date(checkIn) },
      },
    });

    if (overlappingBooking) {
      return res
        .status(400)
        .json({ error: "La habitación no está disponible en esas fechas" });
    }

    // Obtener habitación
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { roomType: true },
    });

    if (!room) return res.status(404).json({ error: "Habitación no encontrada" });

    // Calcular noches y total
    const days = Math.max(
      1,
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const totalPrice = room.roomType.basePrice * days;

    // Crear reserva
    const booking = await prisma.booking.create({
      data: {
        userId,
        roomId,
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        totalPrice,
      },
    });

    // Actualizar estado de habitación
    await prisma.room.update({
      where: { id: roomId },
      data: { status: "occupied" },
    });

    res.json({ message: "Reserva creada correctamente", booking });
  } catch (error) {
    res.status(500).json({ error: "Error al crear la reserva" });
  }
};

//  Actualizar una reserva
export const updateBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const parseResult = updateBookingSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Datos inválidos",
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { checkIn, checkOut } = parseResult.data;

    const booking = await prisma.booking.update({
      where: { id: Number(id) },
      data: { checkIn: new Date(checkIn), checkOut: new Date(checkOut) },
    });

    res.json({ message: "Reserva actualizada", booking });
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar la reserva" });
  }
};

//  Eliminar una reserva
export const deleteBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const booking = await prisma.booking.delete({
      where: { id: Number(id) },
    });

    // Liberar habitación
    await prisma.room.update({
      where: { id: booking.roomId },
      data: { status: "available" },
    });

    res.json({ message: "Reserva eliminada correctamente" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar la reserva" });
  }
};
