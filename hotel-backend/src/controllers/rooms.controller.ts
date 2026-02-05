import { Request, Response } from "express";
import prisma from "../services/prisma";
import { z } from "zod";
import { Prisma, RoomStatus } from "@prisma/client";

/* =====================
   ZOD VALIDATION (CORE)
===================== */

/**
 * Here I validate and coerce the room payload:
 * - I keep number required
 * - I coerce floor/roomTypeId to numbers
 * - I default status to "disponible" if not provided
 */
const createRoomSchema = z.object({
  number: z.string().min(1, "Room number is required"),
  floor: z.preprocess((v) => Number(v), z.number().int().nonnegative()),
  roomTypeId: z.preprocess((v) => Number(v), z.number().int().positive()),

  // Here I treat ""/null/undefined as "not provided" and then default it
  status: z
    .preprocess(
      (v) => (v === undefined || v === null || v === "" ? undefined : v),
      z.nativeEnum(RoomStatus)
    )
    .optional()
    .default(RoomStatus.disponible),

  description: z.string().optional(),
});

// Here I reuse the same schema for updates, but everything becomes optional
const updateRoomSchema = createRoomSchema.partial();

/**
 * Here I check if a room currently has an active check-in.
 * I use this to block risky actions like setting maintenance or deleting an occupied room.
 */
async function hasActiveCheckIn(roomId: number) {
  const active = await prisma.booking.findFirst({
    where: { roomId, status: "checked_in" },
    select: { id: true },
  });
  return !!active;
}

/* =====================
   GET /api/rooms
===================== */

export const getAllRooms = async (req: Request, res: Response) => {
  try {
    /**
     * Here I support:
     * - filters: status, roomTypeId
     * - search: number/description
     * - pagination: page/limit
     */
    const { status, roomTypeId, search } = req.query;

    const pageNum = Number(req.query.page) || 1;
    const limitNum = Number(req.query.limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.RoomWhereInput = {};

    // Here I validate status against the Prisma enum to avoid invalid queries
    if (status && typeof status === "string") {
      if ((Object.values(RoomStatus) as string[]).includes(status)) {
        where.status = status as RoomStatus;
      } else {
        return res.status(400).json({
          success: false,
          code: "INVALID_STATUS",
          error: "Invalid status",
        });
      }
    }

    if (roomTypeId && !isNaN(Number(roomTypeId))) where.roomTypeId = Number(roomTypeId);

    // Here I apply a basic "contains" search on number/description
    if (search && typeof search === "string") {
      where.OR = [{ number: { contains: search } }, { description: { contains: search } }];
    }

    // Here I fetch data + total count in parallel for faster pagination responses
    const [rooms, total] = await Promise.all([
      prisma.room.findMany({
        where,
        orderBy: { number: "asc" },
        skip,
        take: limitNum,
        include: { roomType: true },
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
    return res.status(500).json({ success: false, error: "Error fetching rooms" });
  }
};

/* =====================
   POST /api/rooms
===================== */

export const createRoom = async (req: Request, res: Response) => {
  try {
    // Here I validate the payload before creating the room
    const parsed = createRoomSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        error: "Invalid data",
        details: parsed.error.flatten(),
      });
    }

    // Here I create the room and include its roomType for UI convenience
    const room = await prisma.room.create({
      data: parsed.data,
      include: { roomType: true },
    });

    return res.status(201).json({ success: true, data: room });
  } catch (error: any) {
    console.error("Error en createRoom:", error);

    // Here I handle unique constraint issues (room number must be unique)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(400).json({
        success: false,
        code: "ROOM_NUMBER_EXISTS",
        error: "Room number already exists",
      });
    }

    return res.status(500).json({ success: false, error: "Error creating room" });
  }
};

/* =====================
   GET /api/rooms/:id
===================== */

export const getRoomById = async (req: Request, res: Response) => {
  try {
    // Here I validate the ID param
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: "Invalid ID" });

    const room = await prisma.room.findUnique({
      where: { id },
      include: { roomType: true },
    });

    if (!room) {
      return res.status(404).json({ success: false, error: "Room not found" });
    }

    return res.status(200).json({ success: true, data: room });
  } catch (error) {
    console.error("Error en getRoomById:", error);
    return res.status(500).json({ success: false, error: "Error fetching room" });
  }
};

/* =====================
   PUT /api/rooms/:id
===================== */

export const updateRoom = async (req: Request, res: Response) => {
  try {
    // Here I validate the ID and the payload
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: "Invalid ID" });

    const parsed = updateRoomSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        error: "Invalid data",
        details: parsed.error.flatten(),
      });
    }

    /**
     * Here I enforce "real product" rules for manual status changes:
     * I never allow setting maintenance/available if the room has an active check-in.
     */
    if (parsed.data.status) {
      const occupied = await hasActiveCheckIn(id);

      if (occupied && parsed.data.status === RoomStatus.mantenimiento) {
        return res.status(400).json({
          success: false,
          code: "ROOM_OCCUPIED",
          error: "I can’t set a room to maintenance while it has an active check-in.",
        });
      }

      if (occupied && parsed.data.status === RoomStatus.disponible) {
        return res.status(400).json({
          success: false,
          code: "ROOM_OCCUPIED",
          error: "This room is occupied (active check-in). It can’t be marked as available.",
        });
      }
    }

    // Here I update the room and return the roomType for UI rendering
    const updated = await prisma.room.update({
      where: { id },
      data: parsed.data,
      include: { roomType: true },
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Error en updateRoom:", error);

    if (error.code === "P2025") {
      return res.status(404).json({ success: false, error: "Room not found" });
    }

    return res.status(500).json({ success: false, error: "Error updating room" });
  }
};

/* =====================
   DELETE /api/rooms/:id
===================== */

export const deleteRoom = async (req: Request, res: Response) => {
  try {
    // Here I validate the ID before deleting
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: "Invalid ID" });

    // Here I block deletion if the room has an active check-in
    const occupied = await hasActiveCheckIn(id);
    if (occupied) {
      return res.status(400).json({
        success: false,
        code: "ROOM_OCCUPIED",
        error: "I can’t delete a room with an active check-in.",
      });
    }

    await prisma.room.delete({ where: { id } });

    return res.status(200).json({ success: true, message: "Room deleted successfully" });
  } catch (error) {
    console.error("Error en deleteRoom:", error);
    return res.status(500).json({ success: false, error: "Error deleting room" });
  }
};
