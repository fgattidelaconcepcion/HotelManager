import { Request, Response } from "express";
import prisma from "../services/prisma";
import { z } from "zod";

/* 
        VALIDACIÓN ZOD
 */

const createRoomSchema = z.object({
  number: z.string().min(1, "El número es requerido"),
  floor: z.preprocess((v) => Number(v), z.number().int().nonnegative()),
  roomTypeId: z.preprocess((v) => Number(v), z.number().int().positive()),
  status: z.enum(["disponible", "ocupado", "mantenimiento"]).optional(),
  description: z.string().optional(),
});

const updateRoomSchema = z.object({
  number: z.string().optional(),
  floor: z.preprocess((v) => Number(v), z.number().int()).optional(),
  roomTypeId: z.preprocess((v) => Number(v), z.number().int()).optional(),
  status: z.enum(["disponible", "ocupado", "mantenimiento"]).optional(),
  description: z.string().optional(),
});

/* 
        CONTROLADORES
*/

// Obtener todas las habitaciones
export const getAllRooms = async (_req: Request, res: Response) => {
  try {
    const rooms = await prisma.room.findMany({
      include: { roomType: true },
      orderBy: { number: "asc" },
    });

    return res.status(200).json({ success: true, rooms });
  } catch (err) {
    console.error(" Error obteniendo habitaciones:", err);
    return res.status(500).json({
      success: false,
      error: "Error al obtener habitaciones",
    });
  }
};

// Obtener habitaciones disponibles
export const getAvailableRooms = async (req: Request, res: Response) => {
  try {
    const { checkIn, checkOut } = req.query;

    if (!checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        error: "Faltan parámetros de fecha",
      });
    }

    const checkInDate = new Date(checkIn as string);
    const checkOutDate = new Date(checkOut as string);

    const availableRooms = await prisma.room.findMany({
      where: {
        bookings: {
          none: {
            AND: [
              { checkIn: { lt: checkOutDate } },
              { checkOut: { gt: checkInDate } },
            ],
          },
        },
      },
      include: { roomType: true },
      orderBy: { number: "asc" },
    });

    return res.status(200).json({ success: true, availableRooms });
  } catch (error) {
    console.error(" Error obteniendo habitaciones disponibles:", error);
    return res.status(500).json({
      success: false,
      error: "Error al obtener habitaciones disponibles",
    });
  }
};

// Crear habitación
export const createRoom = async (req: Request, res: Response) => {
  try {
    const parsed = createRoomSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Datos inválidos",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const room = await prisma.room.create({
      data: parsed.data,
    });

    return res.status(201).json({
      success: true,
      message: "Habitación creada correctamente",
      room,
    });
  } catch (err: any) {
    console.error(" Error creando habitación:", err);

    if (err.code === "P2002") {
      return res.status(400).json({
        success: false,
        error: "El número de habitación ya existe",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Error creando habitación",
    });
  }
};

// Eliminar habitación
export const deleteRoom = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "ID inválido" });
    }

    await prisma.room.delete({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Habitación eliminada correctamente",
    });
  } catch (e: any) {
    console.error(" Error eliminando habitación:", e);

    if (e.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: "Habitación no encontrada",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Error al eliminar habitación",
    });
  }
};

// Actualizar habitación
export const updateRoom = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "ID inválido" });
    }

    const parsed = updateRoomSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Datos inválidos",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const updated = await prisma.room.update({
      where: { id },
      data: parsed.data,
    });

    return res.status(200).json({
      success: true,
      message: "Habitación actualizada correctamente",
      updated,
    });
  } catch (e: any) {
    console.error(" Error actualizando habitación:", e);

    if (e.code === "P2025") {
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
