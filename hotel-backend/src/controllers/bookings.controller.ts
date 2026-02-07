import type { Response } from "express";
import prisma from "../services/prisma";
import { z } from "zod";
import { Prisma, BookingStatus, RoomStatus } from "@prisma/client";
import type { AuthRequest } from "../middlewares/authMiddleware";

/**
 * Parse "YYYY-MM-DD" as UTC noon to avoid timezone shifting issues.
 */
function parseDateOnlyToUTCNoon(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) throw new Error("Invalid date-only format");
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0));
}

function parseBookingDate(value: unknown): Date {
  if (value instanceof Date) return value;

  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return parseDateOnlyToUTCNoon(value);
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }

  throw new Error("Invalid date");
}

/* ============================
   ZOD VALIDATION
============================ */

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

  checkIn: z.preprocess((v) => parseBookingDate(v), z.date()),
  checkOut: z.preprocess((v) => parseBookingDate(v), z.date()),
});

const createBookingSchema = baseBookingSchema;
const updateBookingSchema = baseBookingSchema.partial();

const updateStatusSchema = z.object({
  status: z.nativeEnum(BookingStatus),
});

/* ============================
   HELPERS
============================ */

function calculateNights(checkIn: Date, checkOut: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const diffDays = (checkOut.getTime() - checkIn.getTime()) / msPerDay;
  return Math.ceil(diffDays);
}

/**
 * Here I enforce multi-tenant isolation even when checking overlaps:
 * I only consider bookings belonging to the same hotelId.
 */
async function ensureRoomAvailable(
  tx: Prisma.TransactionClient,
  hotelId: number,
  roomId: number,
  checkIn: Date,
  checkOut: Date,
  excludeBookingId?: number
) {
  const where: Prisma.BookingWhereInput = {
    hotelId,
    roomId,
    status: { not: "cancelled" },
    checkIn: { lt: checkOut },
    checkOut: { gt: checkIn },
  };

  if (excludeBookingId) where.id = { not: excludeBookingId };

  const overlapping = await tx.booking.findFirst({ where });
  return !overlapping;
}

function getRoomStatusForBookingTransition(next: BookingStatus): RoomStatus | null {
  if (next === "checked_in") return RoomStatus.ocupado;
  if (next === "checked_out") return RoomStatus.disponible;
  return null;
}

/**
 * Here I calculate how much is still due for a booking.
 * I sum only COMPLETED payments because pending/failed should not reduce the due amount.
 *
 * Note:
 * - I don't fully know if you store "Completed" or "completed" in DB,
 *   so I support both values to make this robust.
 */
async function getBookingDueAmount(
  tx: Prisma.TransactionClient,
  bookingId: number,
  totalPrice: number
): Promise<number> {
  const completed = await tx.payment.aggregate({
    where: {
      bookingId,
      status: { in: ["Completed", "completed"] },
    },
    _sum: { amount: true },
  });

  const paid = Number(completed._sum.amount ?? 0);
  const due = Number(totalPrice) - paid;

  // Here I avoid negative due due to rounding or accidental overpayment.
  return due > 0 ? due : 0;
}

/* ============================
   SAFE SELECTS
============================ */

const guestSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  createdAt: true,
  updatedAt: true,
};

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
};

/* ============================
   CONTROLLERS (MULTI-HOTEL SAFE)
============================ */

/**
 * GET /api/bookings
 * Here I scope everything by req.user.hotelId so hotels never see each other's bookings.
 */
export const getAllBookings = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const { status, roomId, guestId, from, to } = req.query;

    // Here I start the query already scoped to the current hotel
    const where: Prisma.BookingWhereInput = { hotelId };

    if (status && Object.values(BookingStatus).includes(status as BookingStatus)) {
      where.status = status as BookingStatus;
    }

    if (roomId && !isNaN(Number(roomId))) where.roomId = Number(roomId);
    if (guestId && !isNaN(Number(guestId))) where.guestId = Number(guestId);

    const and: Prisma.BookingWhereInput[] = [];
    if (from && typeof from === "string") and.push({ checkIn: { gte: parseBookingDate(from) } });
    if (to && typeof to === "string") and.push({ checkOut: { lte: parseBookingDate(to) } });
    if (and.length) where.AND = and;

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { checkIn: "desc" },
      include: {
        room: { include: { roomType: true } },
        guest: { select: guestSelect },
        user: { select: userSelect },
      },
    });

    return res.status(200).json({ success: true, data: bookings });
  } catch (error) {
    console.error("Error in getAllBookings:", error);
    return res.status(500).json({ success: false, error: "Error fetching bookings" });
  }
};

/**
 * GET /api/bookings/:id
 * Here I enforce tenant isolation by querying with (id + hotelId).
 */
export const getBookingById = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: "Invalid booking ID" });

    const booking = await prisma.booking.findFirst({
      where: { id, hotelId },
      include: {
        room: { include: { roomType: true } },
        guest: { select: guestSelect },
        user: { select: userSelect },
      },
    });

    if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });

    return res.status(200).json({ success: true, data: booking });
  } catch (error) {
    console.error("Error in getBookingById:", error);
    return res.status(500).json({ success: false, error: "Error fetching booking" });
  }
};

/**
 * POST /api/bookings
 * Here I create a booking inside the authenticated user's hotel.
 */
export const createBooking = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const parsed = createBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        error: "Invalid data",
        details: parsed.error.flatten(),
      });
    }

    const data = parsed.data;

    if (data.checkOut <= data.checkIn) {
      return res.status(400).json({
        success: false,
        code: "INVALID_DATES",
        error: "Check-out must be after check-in.",
      });
    }

    /**
     * Here I ensure the room belongs to the same hotel.
     * This prevents booking a room from another tenant.
     */
    const room = await prisma.room.findFirst({
      where: { id: data.roomId, hotelId },
      include: { roomType: true },
    });

    if (!room) {
      return res.status(404).json({ success: false, code: "ROOM_NOT_FOUND", error: "Room not found" });
    }

    if (room.status === RoomStatus.mantenimiento) {
      return res.status(400).json({
        success: false,
        code: "ROOM_IN_MAINTENANCE",
        error: "This room is under maintenance and can’t be booked.",
      });
    }

    if (!room.roomType?.basePrice && room.roomType?.basePrice !== 0) {
      return res.status(400).json({
        success: false,
        code: "ROOM_TYPE_MISSING_PRICE",
        error: "Room type base price is required to create a booking.",
      });
    }

    const booking = await prisma.$transaction(async (tx) => {
      const available = await ensureRoomAvailable(tx, hotelId, data.roomId, data.checkIn, data.checkOut);
      if (!available) {
        const err: any = new Error("ROOM_NOT_AVAILABLE");
        err.code = "ROOM_NOT_AVAILABLE";
        throw err;
      }

      const nights = calculateNights(data.checkIn, data.checkOut);
      const totalPrice = nights * (room.roomType?.basePrice ?? 0);

      return tx.booking.create({
        data: {
          hotelId,
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
          guest: { select: guestSelect },
          user: { select: userSelect },
        },
      });
    });

    return res.status(201).json({ success: true, data: booking });
  } catch (error: any) {
    console.error("Error in createBooking:", error);

    if (error?.code === "ROOM_NOT_AVAILABLE" || error?.message === "ROOM_NOT_AVAILABLE") {
      return res.status(409).json({
        success: false,
        code: "ROOM_NOT_AVAILABLE",
        error: "Room is not available for the selected dates.",
      });
    }

    return res.status(500).json({ success: false, error: "Error creating booking" });
  }
};

/**
 * PUT /api/bookings/:id
 * Here I only allow edits inside the same hotel.
 */
export const updateBooking = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: "Invalid booking ID" });

    const parsed = updateBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        error: "Invalid data",
        details: parsed.error.flatten(),
      });
    }

    const existing = await prisma.booking.findFirst({
      where: { id, hotelId },
      include: { room: { include: { roomType: true } } },
    });

    if (!existing) return res.status(404).json({ success: false, error: "Booking not found" });

    // Here I block edits for finalized bookings
    if (["checked_in", "checked_out", "cancelled"].includes(existing.status)) {
      return res.status(400).json({
        success: false,
        code: "BOOKING_LOCKED",
        error: "This booking can’t be edited in its current status.",
      });
    }

    const nextRoomId = parsed.data.roomId ?? existing.roomId;
    const nextGuestId = parsed.data.guestId ?? existing.guestId ?? undefined;
    const nextUserId = parsed.data.userId ?? existing.userId ?? undefined;
    const nextCheckIn = parsed.data.checkIn ?? existing.checkIn;
    const nextCheckOut = parsed.data.checkOut ?? existing.checkOut;

    if (nextCheckOut <= nextCheckIn) {
      return res.status(400).json({
        success: false,
        code: "INVALID_DATES",
        error: "Check-out must be after check-in.",
      });
    }

    // Here I ensure the new room is also inside the same hotel
    const room = await prisma.room.findFirst({
      where: { id: nextRoomId, hotelId },
      include: { roomType: true },
    });

    if (!room) {
      return res.status(404).json({ success: false, code: "ROOM_NOT_FOUND", error: "Room not found" });
    }

    if (room.status === RoomStatus.mantenimiento) {
      return res.status(400).json({
        success: false,
        code: "ROOM_IN_MAINTENANCE",
        error: "This room is under maintenance and can’t be booked.",
      });
    }

    if (!room.roomType?.basePrice && room.roomType?.basePrice !== 0) {
      return res.status(400).json({
        success: false,
        code: "ROOM_TYPE_MISSING_PRICE",
        error: "Room type base price is required to update a booking.",
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const available = await ensureRoomAvailable(tx, hotelId, nextRoomId, nextCheckIn, nextCheckOut, id);
      if (!available) {
        const err: any = new Error("ROOM_NOT_AVAILABLE");
        err.code = "ROOM_NOT_AVAILABLE";
        throw err;
      }

      const nights = calculateNights(nextCheckIn, nextCheckOut);
      const totalPrice = nights * (room.roomType?.basePrice ?? 0);

      return tx.booking.update({
        where: { id },
        data: {
          roomId: nextRoomId,
          guestId: nextGuestId ?? null,
          userId: nextUserId ?? null,
          checkIn: nextCheckIn,
          checkOut: nextCheckOut,
          totalPrice,
        },
        include: {
          room: { include: { roomType: true } },
          guest: { select: guestSelect },
          user: { select: userSelect },
        },
      });
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Error in updateBooking:", error);

    if (error?.code === "ROOM_NOT_AVAILABLE" || error?.message === "ROOM_NOT_AVAILABLE") {
      return res.status(409).json({
        success: false,
        code: "ROOM_NOT_AVAILABLE",
        error: "Room is not available for the selected dates.",
      });
    }

    return res.status(500).json({ success: false, error: "Error updating booking" });
  }
};

/**
 * PATCH /api/bookings/:id/status
 * Here I enforce tenant isolation, validate transitions, set timestamps,
 * block check-out when there is due amount, and update room status safely.
 */
export const updateBookingStatus = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: "Invalid ID" });

    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, code: "INVALID_STATUS", error: "Invalid status" });
    }

    const next = parsed.data.status;

    const updated = await prisma.$transaction(async (tx) => {
      // Here I load the booking scoped by (id + hotelId) to enforce tenant isolation.
      const booking = await tx.booking.findFirst({
        where: { id, hotelId },
        include: { room: true },
      });

      if (!booking) {
        const err: any = new Error("BOOKING_NOT_FOUND");
        err.code = "BOOKING_NOT_FOUND";
        throw err;
      }

      // Here I define the only allowed status transitions.
      const transitions: Record<BookingStatus, BookingStatus[]> = {
        pending: ["confirmed", "cancelled"],
        confirmed: ["checked_in", "cancelled"],
        checked_in: ["checked_out"],
        checked_out: [],
        cancelled: [],
      };

      if (!transitions[booking.status].includes(next)) {
        const err: any = new Error("INVALID_TRANSITION");
        err.code = "INVALID_TRANSITION";
        err.details = { current: booking.status, next };
        throw err;
      }

      //  Here I block check-out when there is still money due.
      if (next === "checked_out") {
        const due = await getBookingDueAmount(tx, booking.id, booking.totalPrice);
        if (due > 0) {
          const err: any = new Error("BOOKING_HAS_DUE");
          err.code = "BOOKING_HAS_DUE";
          err.details = { due };
          throw err;
        }
      }

      //  Here I set operational timestamps only when entering each state.
      // I don't overwrite timestamps if they already exist.
      const timestampPatch: Prisma.BookingUpdateInput = {};
      if (next === "checked_in" && !booking.checkedInAt) {
        timestampPatch.checkedInAt = new Date();
      }
      if (next === "checked_out" && !booking.checkedOutAt) {
        timestampPatch.checkedOutAt = new Date();
      }

      // Here I update booking status (+ timestamps).
      const bookingUpdated = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: next,
          ...timestampPatch,
        },
        include: {
          room: { include: { roomType: true } },
          guest: { select: guestSelect },
          user: { select: userSelect },
        },
      });

      // Here I update the room status according to the booking transition.
      const roomStatus = getRoomStatusForBookingTransition(next);
      if (roomStatus && booking.roomId) {
        // Here I avoid changing a maintenance room back to available.
        if (!(roomStatus === RoomStatus.disponible && booking.room?.status === RoomStatus.mantenimiento)) {
          await tx.room.update({
            where: { id: booking.roomId },
            data: { status: roomStatus },
          });
        }
      }

      return bookingUpdated;
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Error in updateBookingStatus:", error);

    if (error?.code === "BOOKING_NOT_FOUND" || error?.message === "BOOKING_NOT_FOUND") {
      return res.status(404).json({ success: false, error: "Booking not found" });
    }

    if (error?.code === "INVALID_TRANSITION" || error?.message === "INVALID_TRANSITION") {
      const current = error?.details?.current;
      const next = error?.details?.next;
      return res.status(400).json({
        success: false,
        code: "INVALID_TRANSITION",
        error: current && next ? `Cannot transition from ${current} to ${next}` : "Invalid transition",
      });
    }

    // ✅ Here I return a clear error when check-out is blocked due to pending balance.
    if (error?.code === "BOOKING_HAS_DUE" || error?.message === "BOOKING_HAS_DUE") {
      const due = error?.details?.due;
      return res.status(400).json({
        success: false,
        code: "BOOKING_HAS_DUE",
        error: "Cannot check-out while there is an outstanding balance.",
        details: { due },
      });
    }

    return res.status(500).json({ success: false, error: "Error updating status" });
  }
};

/**
 * DELETE /api/bookings/:id
 * Here I only allow deletion inside the same hotel.
 */
export const deleteBooking = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: "Invalid booking ID" });

    // Here I enforce tenant isolation: I must own the booking
    const booking = await prisma.booking.findFirst({
      where: { id, hotelId },
      select: { id: true },
    });

    if (!booking) {
      return res.status(404).json({ success: false, error: "Booking not found" });
    }

    await prisma.booking.delete({ where: { id } });
    return res.status(200).json({ success: true, message: "Booking deleted successfully" });
  } catch (error: any) {
    console.error("Error in deleteBooking:", error);
    return res.status(500).json({ success: false, error: "Error deleting booking" });
  }
};
