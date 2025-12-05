import { Request, Response } from "express";
import prisma from "../services/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";

// -----------------------------
// VALIDACIÓN ZOD
// -----------------------------
const createRoomTypeSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  basePrice: z.preprocess((v) => Number(v), z.number().positive()),
  capacity: z.preprocess((v) => Number(v), z.number().int().positive()),
});

// -----------------------------
// OBTENER TODOS LOS TIPOS
// GET /api/room-types
// -----------------------------
export const getRoomTypes = async (_req: Request, res: Response) => {
  try {
    const types = await prisma.roomType.findMany({
      orderBy: { id: "asc" },
    });

    return res.status(200).json({
      success: true,
      data: types,
    });
  } catch (error) {
    console.error("Error en getRoomTypes:", error);
    return res
      .status(500)
      .json({ success: false, error: "Error al obtener room types" });
  }
};

// -----------------------------
// CREAR TIPO DE HABITACIÓN
// POST /api/room-types
// -----------------------------
export const createRoomType = async (req: Request, res: Response) => {
  try {
    const parsed = createRoomTypeSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Datos inválidos",
        details: parsed.error.flatten(),
      });
    }

    const data = parsed.data;

    const newType = await prisma.roomType.create({
      data: {
        name: data.name,
        basePrice: data.basePrice,
        capacity: data.capacity,
      },
    });

    return res.status(201).json({
      success: true,
      data: newType,
    });
  } catch (error: any) {
    console.error("Error en createRoomType:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(400).json({
        success: false,
        error: "El nombre del tipo ya existe",
      });
    }

    return res
      .status(500)
      .json({ success: false, error: "Error al crear room type" });
  }
};
