import { Request, Response } from "express";
import prisma from "../services/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";

/* 
        VALIDACIÓN ZOD
*/

const createRoomSchema = z.object({
  number: z.string().min(1, "El número es requerido"),
  floor: z.preprocess((v) => Number(v), z.number().int().nonnegative()),
  roomTypeId: z.preprocess((v) => Number(v), z.number().int().positive()),
  status: z
    .enum(["disponible", "ocupado", "mantenimiento"])
    .optional()
    .default("disponible"),
  description: z.string().optional(),
});

const updateRoomSchema = createRoomSchema.partial();

/* 
        OBTENER TODAS LAS HABITACIONES (con filtros + paginación básica)
        GET /api/rooms?status=disponible&roomTypeId=1&page=1&limit=10
*/

export const getAllRooms = async (req: Request, res: Response) => {
  try {
    const { status, roomTypeId, search, page = "1", limit = "20" } = req.query;

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.RoomWhereInput = {};

    if (status && typeof status === "string") {
      where.status = status as any;
    }

    if (roomTypeId && !isNaN(Number(roomTypeId))) {
      where.roomTypeId = Number(roomTypeId);
    }

    if (search && typeof search === "string") {
  where.OR = [
    { number: { contains: search } },
    { description: { contains: search } },
  ];
}

    const [rooms, total] = await Promise.all([
      prisma.room.findMany({
        where,
        include: { roomType: true },
        orderBy: { number: "asc" },
        skip,
        take: limitNum,
      }),
      prisma.room.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: rooms,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Error en getAllRooms:", error);
    return res.status(500).json({
      success: false,
      error: "Error al obtener habitaciones",
    });
  }
};

/* 
        CREAR HABITACIÓN
        POST /api/rooms
*/

export const createRoom = async (req: Request, res: Response) => {
  try {
    const parsed = createRoomSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Datos inválidos",
        details: parsed.error.flatten(),
      });
    }

    const data = parsed.data;

    const room = await prisma.room.create({
      data: {
        number: data.number,
        floor: data.floor,
        roomTypeId: data.roomTypeId,
        status: data.status ?? "disponible",
        description: data.description,
      },
      include: { roomType: true },
    });

    return res.status(201).json({
      success: true,
      data: room,
    });
  } catch (error: any) {
    console.error("Error en createRoom:", error);

    // P2002 -> unique constraint (por ejemplo, número de habitación duplicado)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(400).json({
        success: false,
        error: "El número de habitación ya existe",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Error al crear habitación",
    });
  }
};

export const getRoomById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid room ID." });
    }

    const room = await prisma.room.findUnique({
      where: { id },
      include: { roomType: true },
    });

    if (!room) {
      return res.status(404).json({ success: false, error: "Room not found." });
    }

    return res.status(200).json({ success: true, data: room });
  } catch (error) {
    console.error("Error en getRoomById:", error);
    return res.status(500).json({ success: false, error: "Error getting room" });
  }
};


/* 
        ACTUALIZAR HABITACIÓN
        PUT /api/rooms/:id
*/

export const updateRoom = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res
        .status(400)
        .json({ success: false, error: "ID de habitación inválido" });
    }

    const parsed = updateRoomSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Datos inválidos",
        details: parsed.error.flatten(),
      });
    }

    const data = parsed.data;

    const updated = await prisma.room.update({
      where: { id },
      data: {
        number: data.number ?? undefined,
        floor:
          typeof data.floor === "number" && !isNaN(data.floor)
            ? data.floor
            : undefined,
        roomTypeId:
          typeof data.roomTypeId === "number" && !isNaN(data.roomTypeId)
            ? data.roomTypeId
            : undefined,
        status: data.status ?? undefined,
        description: data.description ?? undefined,
      },
      include: { roomType: true },
    });

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (e: any) {
    console.error("Error en updateRoom:", e);

    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      return res.status(404).json({
        success: false,
        error: "Habitación no encontrada",
      });
    }

    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return res.status(400).json({
        success: false,
        error: "El número de habitación ya existe",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Error al actualizar habitación",
    });
  }
};

/* 
        ELIMINAR HABITACIÓN
        DELETE /api/rooms/:id
*/

export const deleteRoom = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res
        .status(400)
        .json({ success: false, error: "ID de habitación inválido" });
    }

    await prisma.room.delete({
      where: { id },
    });

    return res
      .status(200)
      .json({ success: true, message: "Habitación eliminada correctamente" });
  } catch (e: any) {
    console.error("Error en deleteRoom:", e);

    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      return res.status(404).json({
        success: false,
        error: "Habitación no encontrada",
      });
    }

    // P2003 -> error de FK (por ejemplo, reservas asociadas)
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2003"
    ) {
      return res.status(409).json({
        success: false,
        error:
          "No se puede eliminar la habitación porque tiene reservas asociadas",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Error al eliminar habitación",
    });
  }
};

/* 
        HABITACIONES DISPONIBLES
        GET /api/rooms/available?checkIn=2025-12-01&checkOut=2025-12-05&roomTypeId=1
*/

export const getAvailableRooms = async (req: Request, res: Response) => {
  try {
    const { checkIn, checkOut, roomTypeId } = req.query;

    if (!checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        error: "Faltan parámetros de fecha (checkIn y checkOut)",
      });
    }

    const checkInDate = new Date(checkIn as string);
    const checkOutDate = new Date(checkOut as string);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: "Formato de fecha inválido",
      });
    }

    if (checkOutDate <= checkInDate) {
      return res.status(400).json({
        success: false,
        error: "checkOut debe ser posterior a checkIn",
      });
    }

    const whereRoom: Prisma.RoomWhereInput = {
      status: "disponible",
      bookings: {
        none: {
          // Solapamiento de fechas:
          // (booking.checkIn < checkOutSolicitado) && (booking.checkOut > checkInSolicitado)
          AND: [
            { checkIn: { lt: checkOutDate } },
            { checkOut: { gt: checkInDate } },
          ],
        },
      },
    };

    if (roomTypeId && !isNaN(Number(roomTypeId))) {
      whereRoom.roomTypeId = Number(roomTypeId);
    }

    const availableRooms = await prisma.room.findMany({
      where: whereRoom,
      include: { roomType: true },
      orderBy: { number: "asc" },
    });

    return res.status(200).json({
      success: true,
      data: availableRooms,
    });
  } catch (error) {
    console.error("Error en getAvailableRooms:", error);
    return res.status(500).json({
      success: false,
      error: "Error al obtener habitaciones disponibles",
    });
  }
};
