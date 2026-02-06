import type { Response } from "express";
import prisma from "../services/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import type { AuthRequest } from "../middlewares/authMiddleware";

/* =========================
   ZOD VALIDATION
========================= */

const createRoomTypeSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  basePrice: z.preprocess((v) => Number(v), z.number().nonnegative()),
  capacity: z.preprocess((v) => Number(v), z.number().int().positive()),
});

const updateRoomTypeSchema = createRoomTypeSchema.partial();

/* =========================
   GET /api/room-types
   MULTI-HOTEL SAFE
========================= */

export const getRoomTypes = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    // Here I return only room types belonging to the current hotel tenant
    const types = await prisma.roomType.findMany({
      where: { hotelId },
      orderBy: { id: "asc" },
    });

    return res.status(200).json({ success: true, data: types });
  } catch (error) {
    console.error("Error in getRoomTypes:", error);
    return res.status(500).json({ success: false, error: "Error fetching room types" });
  }
};

/* =========================
   POST /api/room-types
   MULTI-HOTEL SAFE
========================= */

export const createRoomType = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const parsed = createRoomTypeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        error: "Invalid data",
        details: parsed.error.flatten(),
      });
    }

    const data = parsed.data;

    // Here I prevent duplicates per hotel (hotelId + name)
    const existing = await prisma.roomType.findFirst({
      where: { hotelId, name: data.name },
      select: { id: true },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        code: "ROOM_TYPE_EXISTS",
        error: "Room type name already exists in this hotel",
      });
    }

    // Here I create the room type inside this hotel tenant
    const created = await prisma.roomType.create({
      data: {
        hotelId,
        name: data.name,
        basePrice: data.basePrice,
        capacity: data.capacity,
      },
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    console.error("Error in createRoomType:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({
        success: false,
        code: "ROOM_TYPE_EXISTS",
        error: "Room type name already exists in this hotel",
      });
    }

    return res.status(500).json({ success: false, error: "Error creating room type" });
  }
};

/* =========================
   PUT /api/room-types/:id
   MULTI-HOTEL SAFE
========================= */

export const updateRoomType = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) return res.status(401).json({ success: false, error: "Missing hotel context" });

    const id = Number(req.params.id);
    if (Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: "Invalid room type ID" });
    }

    const parsed = updateRoomTypeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        error: "Invalid data",
        details: parsed.error.flatten(),
      });
    }

    // Here I ensure the room type belongs to this hotel tenant
    const existing = await prisma.roomType.findFirst({
      where: { id, hotelId },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "Room type not found" });
    }

    // Here I block duplicate name within the same hotel if user is updating name
    if (parsed.data.name) {
      const dup = await prisma.roomType.findFirst({
        where: {
          hotelId,
          name: parsed.data.name,
          id: { not: id },
        },
        select: { id: true },
      });

      if (dup) {
        return res.status(409).json({
          success: false,
          code: "ROOM_TYPE_EXISTS",
          error: "Room type name already exists in this hotel",
        });
      }
    }

    const updated = await prisma.roomType.update({
      where: { id },
      data: parsed.data,
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Error in updateRoomType:", error);
    return res.status(500).json({ success: false, error: "Error updating room type" });
  }
};

/* =========================
   DELETE /api/room-types/:id
   MULTI-HOTEL SAFE
========================= */

export const deleteRoomType = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) return res.status(401).json({ success: false, error: "Missing hotel context" });

    const id = Number(req.params.id);
    if (Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: "Invalid room type ID" });
    }

    // Here I ensure tenant isolation (id + hotelId)
    const existing = await prisma.roomType.findFirst({
      where: { id, hotelId },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "Room type not found" });
    }

    // Here I block deletion if there are rooms using this type (optional but recommended)
    const roomsUsing = await prisma.room.count({
      where: { hotelId, roomTypeId: id },
    });

    if (roomsUsing > 0) {
      return res.status(400).json({
        success: false,
        code: "ROOM_TYPE_IN_USE",
        error: "I can’t delete a room type that is assigned to rooms.",
      });
    }

    await prisma.roomType.delete({ where: { id } });

    return res.status(200).json({ success: true, message: "Room type deleted successfully" });
  } catch (error) {
    console.error("Error in deleteRoomType:", error);
    return res.status(500).json({ success: false, error: "Error deleting room type" });
  }
};
