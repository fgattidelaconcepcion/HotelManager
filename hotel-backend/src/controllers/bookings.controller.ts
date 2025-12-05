import { Request, Response } from "express";
import prisma from "../services/prisma";
import { z } from "zod";
import { Prisma, BookingStatus } from "@prisma/client";

/* =====================================
      VALIDACIÓN ZOD
===================================== */

const baseBookingSchema = z.object({
  roomId: z.preprocess((v) => Number(v), z.number().int().positive()),
  userId: z
    .preprocess(
      (v) => (v === undefined || v === null || v === "" ? undefined : Number(v)),
      z.number().int().positive()
    )
    .optional(),
  guestId: z
    .preprocess(
      (v) => (v === undefined || v === null || v === "" ? undefined : Number(v)),
      z.number().int().positive()
    )
    .optional(),
  checkIn: z.coerce.date(),
  checkOut: z.coerce.date(),
});

const createBookingSchema = baseBookingSchema;
const updateBookingSchema = baseBookingSchema.partial();

const updateStatusSchema = z.object({
  status: z.nativeEnum(BookingStatus),
});

/* =====================================
      HELPERS
===================================== */

function calculateNights(checkIn: Date, checkOut: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const diff = (checkOut.getTime() - checkIn.getTime()) / msPerDay;
  return Math.max(1, Math.round(diff));
}

async function checkRoomAvailability(
  roomId: number,
  checkIn: Date,
  checkOut: Date,
  excludeBookingId?: number
) {
  const where: Prisma.BookingWhereInput = {
    roomId,
    status: {
      not: "cancelled",
    },
    // solapamiento: (existing.checkIn < newCheckOut) && (existing.checkOut > newCheckIn)
    checkIn: {
      lt: checkOut,
    },
    checkOut: {
      gt: checkIn,
    },
  };

  if (excludeBookingId) {
    where.id = { not: excludeBookingId };
  }

  const overlapping = await prisma.booking.findFirst({ where });

  return !overlapping;
}

/* =====================================
      CONTROLADORES
===================================== */

// GET /api/bookings
export const getAllBookings = async (req: Request, res: Response) => {
  try {
    const { status, roomId, guestId, from, to } = req.query;

    const where: Prisma.BookingWhereInput = {};

    if (status && typeof status === "string") {
      if (Object.values(BookingStatus).includes(status as BookingStatus)) {
        where.status = status as BookingStatus;
      }
    }

    if (roomId && !isNaN(Number(roomId))) {
      where.roomId = Number(roomId);
    }

    if (guestId && !isNaN(Number(guestId))) {
      where.guestId = Number(guestId);
    }

    const dateFilters: Prisma.BookingWhereInput[] = [];

    if (from) {
      const fromDate = new Date(from as string);
      if (!isNaN(fromDate.getTime())) {
        dateFilters.push({ checkIn: { gte: fromDate } });
      }
    }

    if (to) {
      const toDate = new Date(to as string);
      if (!isNaN(toDate.getTime())) {
        dateFilters.push({ checkOut: { lte: toDate } });
      }
    }

    if (dateFilters.length) {
      where.AND = dateFilters;
    }

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { checkIn: "desc" },
      include: {
        room: {
          include: { roomType: true },
        },
        guest: true,
        user: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    console.error("Error en getAllBookings:", error);
    return res.status(500).json({
      success: false,
      error: "Error al obtener reservas",
    });
  }
};

// GET /api/bookings/:id
export const getBookingById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res
        .status(400)
        .json({ success: false, error: "ID de reserva inválido" });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        room: { include: { roomType: true } },
        guest: true,
        user: true,
      },
    });

    if (!booking) {
      return res
        .status(404)
        .json({ success: false, error: "Reserva no encontrada" });
    }

    return res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error("Error en getBookingById:", error);
    return res.status(500).json({
      success: false,
      error: "Error al obtener la reserva",
    });
  }
};

// POST /api/bookings
export const createBooking = async (req: Request, res: Response) => {
  try {
    const parsed = createBookingSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Datos inválidos",
        details: parsed.error.flatten(),
      });
    }

    const data = parsed.data;

    if (data.checkOut <= data.checkIn) {
      return res.status(400).json({
        success: false,
        error: "La fecha de check-out debe ser posterior al check-in",
      });
    }

    const room = await prisma.room.findUnique({
      where: { id: data.roomId },
      include: { roomType: true },
    });

    if (!room) {
      return res
        .status(404)
        .json({ success: false, error: "Habitación no encontrada" });
    }

    const isAvailable = await checkRoomAvailability(
      data.roomId,
      data.checkIn,
      data.checkOut
    );

    if (!isAvailable) {
      return res.status(409).json({
        success: false,
        error: "La habitación no está disponible en ese rango de fechas",
      });
    }

    const nights = calculateNights(data.checkIn, data.checkOut);
    const totalPrice = nights * room.roomType.basePrice;

    const booking = await prisma.booking.create({
      data: {
        roomId: data.roomId,
        userId: data.userId,
        guestId: data.guestId,
        checkIn: data.checkIn,
        checkOut: data.checkOut,
        totalPrice,
        status: "pending",
      },
      include: {
        room: { include: { roomType: true } },
        guest: true,
        user: true,
      },
    });

    return res.status(201).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error("Error en createBooking:", error);
    return res.status(500).json({
      success: false,
      error: "Error al crear la reserva",
    });
  }
};

// PUT /api/bookings/:id
export const updateBooking = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res
        .status(400)
        .json({ success: false, error: "ID de reserva inválido" });
    }

    const parsed = updateBookingSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Datos inválidos",
        details: parsed.error.flatten(),
      });
    }

    const existing = await prisma.booking.findUnique({
      where: { id },
      include: { room: { include: { roomType: true } } },
    });

    if (!existing) {
      return res
        .status(404)
        .json({ success: false, error: "Reserva no encontrada" });
    }

    const newRoomId = parsed.data.roomId ?? existing.roomId;
    const newCheckIn = parsed.data.checkIn ?? existing.checkIn;
    const newCheckOut = parsed.data.checkOut ?? existing.checkOut;

    if (newCheckOut <= newCheckIn) {
      return res.status(400).json({
        success: false,
        error: "La fecha de check-out debe ser posterior al check-in",
      });
    }

    const room = await prisma.room.findUnique({
      where: { id: newRoomId },
      include: { roomType: true },
    });

    if (!room) {
      return res
        .status(404)
        .json({ success: false, error: "Habitación no encontrada" });
    }

    const isAvailable = await checkRoomAvailability(
      newRoomId,
      newCheckIn,
      newCheckOut,
      id
    );

    if (!isAvailable) {
      return res.status(409).json({
        success: false,
        error: "La habitación no está disponible en ese rango de fechas",
      });
    }

    const nights = calculateNights(newCheckIn, newCheckOut);
    const totalPrice = nights * room.roomType.basePrice;

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        roomId: newRoomId,
        checkIn: newCheckIn,
        checkOut: newCheckOut,
        totalPrice,
      },
      include: {
        room: { include: { roomType: true } },
        guest: true,
        user: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Error en updateBooking:", error);
    return res.status(500).json({
      success: false,
      error: "Error al actualizar la reserva",
    });
  }
};

// PATCH /api/bookings/:id/status
export const updateBookingStatus = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res
        .status(400)
        .json({ success: false, error: "ID de reserva inválido" });
    }

    const parsed = updateStatusSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Estado inválido",
        details: parsed.error.flatten(),
      });
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        status: parsed.data.status,
      },
      include: {
        room: { include: { roomType: true } },
        guest: true,
        user: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    console.error("Error en updateBookingStatus:", error);

    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, error: "Reserva no encontrada" });
    }

    return res.status(500).json({
      success: false,
      error: "Error al actualizar el estado de la reserva",
    });
  }
};

// DELETE /api/bookings/:id
export const deleteBooking = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res
        .status(400)
        .json({ success: false, error: "ID de reserva inválido" });
    }

    await prisma.booking.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: "Reserva eliminada correctamente",
    });
  } catch (error: any) {
    console.error("Error en deleteBooking:", error);

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
