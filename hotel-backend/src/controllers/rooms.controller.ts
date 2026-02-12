import type { Response } from "express";
import prisma from "../services/prisma";
import { z } from "zod";
import { Prisma, RoomStatus } from "@prisma/client";
import type { AuthRequest } from "../middlewares/authMiddleware";

/* =====================
   ZOD VALIDATION (CORE)
===================== */

/**
 * Here I validate and coerce the room payload:
 * - number required
 * - floor coerced to int
 * - roomTypeId required (because Prisma model requires it)
 * - status defaults to "disponible"
 */
const createRoomSchema = z.object({
  number: z.string().min(1, "Room number is required"),

  /**
   * Here I coerce floor to a number and validate it's a non-negative integer.
   */
  floor: z.preprocess((v) => Number(v), z.number().int().nonnegative()),

  /**
   * IMPORTANT:
   * Here I treat ""/null/undefined as "missing" instead of converting to 0.
   * This avoids the classic Number("") === 0 validation bug.
   *
   * NOTE ABOUT ZOD v4:
   * - Zod v4 removed the `{ required_error: ... }` option (v3 style).
   * - So I enforce "required" by ensuring the value is a positive integer.
   */
  roomTypeId: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z
      .number({
        invalid_type_error: "Room type is required",
      })
      .int("Room type is required")
      .positive("Room type is required")
  ),

  /**
   * Here I validate the status against the Prisma enum.
   * - If the incoming value is empty, I treat it as missing.
   * - Default is "disponible".
   */
  status: z
    .preprocess(
      (v) => (v === undefined || v === null || v === "" ? undefined : v),
      z.nativeEnum(RoomStatus)
    )
    .optional()
    .default(RoomStatus.disponible),

  description: z.string().optional(),
});

const updateRoomSchema = createRoomSchema.partial();

/* =====================
   INTERNAL HELPERS
===================== */

async function hasActiveCheckIn(roomId: number, hotelId: number) {
  const active = await prisma.booking.findFirst({
    where: {
      roomId,
      hotelId,
      status: "checked_in",
    },
    select: { id: true },
  });

  return !!active;
}

/* =====================
   GET /api/rooms
===================== */

export const getAllRooms = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) return res.status(401).json({ success: false, error: "Missing hotel context" });

    const { status, roomTypeId, search } = req.query;

    const pageNum = Number(req.query.page) || 1;
    const limitNum = Number(req.query.limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.RoomWhereInput = { hotelId };

    if (status && typeof status === "string") {
      if ((Object.values(RoomStatus) as string[]).includes(status)) {
        where.status = status as RoomStatus;
      } else {
        return res
          .status(400)
          .json({ success: false, code: "INVALID_STATUS", error: "Invalid status" });
      }
    }

    if (roomTypeId && !isNaN(Number(roomTypeId))) where.roomTypeId = Number(roomTypeId);

    if (search && typeof search === "string") {
      where.OR = [{ number: { contains: search } }, { description: { contains: search } }];
    }

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
    console.error("Error in getAllRooms:", error);
    return res.status(500).json({ success: false, error: "Error fetching rooms" });
  }
};

/* =====================
   POST /api/rooms
===================== */

export const createRoom = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) return res.status(401).json({ success: false, error: "Missing hotel context" });

    const parsed = createRoomSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        error: "Invalid data",
        details: parsed.error.flatten(),
      });
    }

    //  MULTI-TENANT SAFETY: roomType must belong to this hotel
    const roomType = await prisma.roomType.findFirst({
      where: { id: parsed.data.roomTypeId, hotelId },
      select: { id: true },
    });

    if (!roomType) {
      return res.status(400).json({
        success: false,
        code: "INVALID_ROOM_TYPE",
        error: "Room type does not exist in this hotel",
      });
    }

    const room = await prisma.room.create({
      data: {
        hotelId,
        ...parsed.data,
      },
      include: { roomType: true },
    });

    return res.status(201).json({ success: true, data: room });
  } catch (error: any) {
    console.error("Error in createRoom:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(400).json({
        success: false,
        code: "ROOM_NUMBER_EXISTS",
        error: "Room number already exists in this hotel",
      });
    }

    return res.status(500).json({ success: false, error: "Error creating room" });
  }
};

/* =====================
   GET /api/rooms/:id
===================== */

export const getRoomById = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) return res.status(401).json({ success: false, error: "Missing hotel context" });

    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: "Invalid ID" });

    const room = await prisma.room.findFirst({
      where: { id, hotelId },
      include: { roomType: true },
    });

    if (!room) return res.status(404).json({ success: false, error: "Room not found" });

    return res.status(200).json({ success: true, data: room });
  } catch (error) {
    console.error("Error in getRoomById:", error);
    return res.status(500).json({ success: false, error: "Error fetching room" });
  }
};

/* =====================
   PUT /api/rooms/:id
===================== */

export const updateRoom = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) return res.status(401).json({ success: false, error: "Missing hotel context" });

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

    const existingRoom = await prisma.room.findFirst({
      where: { id, hotelId },
      select: { id: true },
    });

    if (!existingRoom) return res.status(404).json({ success: false, error: "Room not found" });

    // If roomTypeId is being changed, validate it belongs to this hotel
    if (parsed.data.roomTypeId) {
      const roomType = await prisma.roomType.findFirst({
        where: { id: parsed.data.roomTypeId, hotelId },
        select: { id: true },
      });

      if (!roomType) {
        return res.status(400).json({
          success: false,
          code: "INVALID_ROOM_TYPE",
          error: "Room type does not exist in this hotel",
        });
      }
    }

    if (parsed.data.status) {
      const occupied = await hasActiveCheckIn(id, hotelId);

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

    const updated = await prisma.room.update({
      where: { id },
      data: parsed.data,
      include: { roomType: true },
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Error in updateRoom:", error);
    return res.status(500).json({ success: false, error: "Error updating room" });
  }
};

/* =====================
   DELETE /api/rooms/:id
===================== */

export const deleteRoom = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) return res.status(401).json({ success: false, error: "Missing hotel context" });

    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: "Invalid ID" });

    const room = await prisma.room.findFirst({
      where: { id, hotelId },
      select: { id: true },
    });

    if (!room) return res.status(404).json({ success: false, error: "Room not found" });

    const occupied = await hasActiveCheckIn(id, hotelId);
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
    console.error("Error in deleteRoom:", error);
    return res.status(500).json({ success: false, error: "Error deleting room" });
  }
};
