import { Request, Response } from "express";
import prisma from "../services/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";

// -----------------------------
// ZOD VALIDATION (CORE)
// -----------------------------
/**
 * Here I validate the room type payload and coerce numeric fields
 * because they often come as strings from the frontend.
 */
const createRoomTypeSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  basePrice: z.preprocess((v) => Number(v), z.number().positive()),
  capacity: z.preprocess((v) => Number(v), z.number().int().positive()),
});

// -----------------------------
// GET /api/room-types
// -----------------------------
export const getRoomTypes = async (_req: Request, res: Response) => {
  try {
    // Here I fetch all room types ordered by id for predictable UI rendering
    const types = await prisma.roomType.findMany({
      orderBy: { id: "asc" },
    });

    return res.status(200).json({
      success: true,
      data: types,
    });
  } catch (error) {
    console.error("Error en getRoomTypes:", error);
    return res.status(500).json({
      success: false,
      error: "Error fetching room types",
    });
  }
};

// -----------------------------
// POST /api/room-types
// -----------------------------
export const createRoomType = async (req: Request, res: Response) => {
  try {
    // Here I validate input before creating the room type
    const parsed = createRoomTypeSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid data",
        details: parsed.error.flatten(),
      });
    }

    const data = parsed.data;

    // Here I create the room type (name should be unique)
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

    // Here I handle unique constraint errors (duplicate room type name)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(400).json({
        success: false,
        error: "Room type name already exists",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Error creating room type",
    });
  }
};
