import { Request, Response } from "express";
import prisma from "../services/prisma";
import { z } from "zod";

// 
//   VALIDACIÓN ZOD
// 
const createRoomTypeSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  basePrice: z.preprocess((v) => Number(v), z.number().positive()),
  capacity: z.preprocess((v) => Number(v), z.number().int().positive()),
});

// 
//   CONTROLADORES
// 

export const getRoomTypes = async (_req: Request, res: Response) => {
  try {
    const types = await prisma.roomType.findMany({
      orderBy: { id: "asc" },
    });

    return res.status(200).json({ success: true, types });
  } catch (error) {
    console.error(" Error obteniendo room types:", error);

    return res
      .status(500)
      .json({ success: false, error: "Error al obtener room types" });
  }
};

export const createRoomType = async (req: Request, res: Response) => {
  try {
    const parsed = createRoomTypeSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Datos inválidos",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { name, basePrice, capacity } = parsed.data;

    // Crear tipo de habitación
    const newType = await prisma.roomType.create({
      data: { name, basePrice, capacity },
    });

    return res.status(201).json({
      success: true,
      message: "Tipo de habitación creado correctamente",
      roomType: newType,
    });
  } catch (error: any) {
    console.error(" Error creando room type:", error);

    // Error por duplicado (si usás un índice único)
    if (error.code === "P2002") {
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
