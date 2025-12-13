import { Request, Response } from "express";
import prisma from "../services/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";

/* =====================
   VALIDACIÓN ZOD
===================== */

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

/* =====================
   GET /api/rooms
===================== */

export const getAllRooms = async (req: Request, res: Response) => {
  try {
    const { status, roomTypeId, search } = req.query;

    const pageNum = Number(req.query.page) || 1;
    const limitNum = Number(req.query.limit) || 20;
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

/* =====================
   POST /api/rooms
===================== */

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

    const room = await prisma.room.create({
      data: parsed.data,
    });

    return res.status(201).json({
      success: true,
      data: room,
    });
  } catch (error: any) {
    console.error("Error en createRoom:", error);

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

/* =====================
   GET /api/rooms/:id
===================== */

export const getRoomById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: "ID inválido",
      });
    }

    const room = await prisma.room.findUnique({
      where: { id },
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        error: "Habitación no encontrada",
      });
    }

    return res.status(200).json({
      success: true,
      data: room,
    });
  } catch (error) {
    console.error("Error en getRoomById:", error);
    return res.status(500).json({
      success: false,
      error: "Error al obtener habitación",
    });
  }
};

/* =====================
   PUT /api/rooms/:id
===================== */

export const updateRoom = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: "ID inválido",
      });
    }

    const parsed = updateRoomSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Datos inválidos",
      });
    }

    const updated = await prisma.room.update({
      where: { id },
      data: parsed.data,
    });

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    console.error("Error en updateRoom:", error);

    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: "Habitación no encontrada",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Error al actualizar habitación",
    });
  }
};

/* =====================
   DELETE /api/rooms/:id
===================== */

export const deleteRoom = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: "ID inválido",
      });
    }

    await prisma.room.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: "Habitación eliminada correctamente",
    });
  } catch (error) {
    console.error("Error en deleteRoom:", error);
    return res.status(500).json({
      success: false,
      error: "Error al eliminar habitación",
    });
  }
};
