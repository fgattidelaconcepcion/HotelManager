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

const moveRoomSchema = z.object({
  roomId: z.preprocess((v) => Number(v), z.number().int().positive()),
});


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
 * Here I calculate how much was already paid for a booking (ONLY completed).
 * I support both "completed" and "Completed" to be robust.
 */
async function getBookingPaidAmount(
  tx: Prisma.TransactionClient,
  bookingId: number
): Promise<number> {
  const completed = await tx.payment.aggregate({
    where: {
      bookingId,
      status: { in: ["completed", "Completed"] },
    },
    _sum: { amount: true },
  });

  return Number(completed._sum.amount ?? 0);
}

/**
 * Here I calculate the total charges (consumption/extras) for a booking.
 * Charge.total is stored as int (UYU cents or UYU integer based on your design).
 */
async function getBookingChargesTotal(
  tx: Prisma.TransactionClient,
  bookingId: number
): Promise<number> {
  // If you haven't added Charge model yet, this will fail at compile time.
  // After prisma migrate + generate, it works.
  const agg = await tx.charge.aggregate({
    where: { bookingId },
    _sum: { total: true },
  });

  return Number(agg._sum.total ?? 0);
}

/**
 * Here I calculate how much is still due for a booking.
 * Professional rule:
 *   due = (totalPrice + chargesTotal) - paidCompleted
 */
async function getBookingDueAmount(
  tx: Prisma.TransactionClient,
  bookingId: number,
  totalPrice: number
): Promise<{ paid: number; charges: number; due: number }> {
  const [paid, charges] = await Promise.all([
    getBookingPaidAmount(tx, bookingId),
    getBookingChargesTotal(tx, bookingId),
  ]);

  const raw = Number(totalPrice) + Number(charges) - Number(paid);
  const due = raw > 0 ? raw : 0;

  return { paid, charges, due };
}

/* ============================
   SAFE SELECTS
============================ */

const guestSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  documentNumber: true,
  address: true,
  createdAt: true,
  updatedAt: true,

  // Optional extra fields (if you added them in schema)
  documentType: true,
  nationality: true,
  birthDate: true,
  gender: true,
  city: true,
  country: true,
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
 *
 * PRO: I also return computed fields:
 * - paidCompleted
 * - chargesTotal
 * - dueAmount
 */
export const getAllBookings = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const { status, roomId, guestId, from, to } = req.query;

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

    // Here I compute paid/charges/due in bulk to keep the endpoint fast.
    const bookingIds = bookings.map((b) => b.id);

    const [paymentsGrouped, chargesGrouped] = await Promise.all([
      prisma.payment.groupBy({
        by: ["bookingId"],
        where: {
          bookingId: { in: bookingIds },
          status: { in: ["completed", "Completed"] },
        },
        _sum: { amount: true },
      }),
      prisma.charge.groupBy({
        by: ["bookingId"],
        where: { bookingId: { in: bookingIds } },
        _sum: { total: true },
      }),
    ]);

    const paidMap = new Map<number, number>();
    for (const row of paymentsGrouped) paidMap.set(row.bookingId, Number(row._sum.amount ?? 0));

    const chargesMap = new Map<number, number>();
    for (const row of chargesGrouped) chargesMap.set(row.bookingId, Number(row._sum.total ?? 0));

    const enriched = bookings.map((b) => {
      const paidCompleted = paidMap.get(b.id) ?? 0;
      const chargesTotal = chargesMap.get(b.id) ?? 0;
      const dueAmount = Math.max(Number(b.totalPrice) + chargesTotal - paidCompleted, 0);

      return {
        ...b,
        paidCompleted,
        chargesTotal,
        dueAmount,
      };
    });

    return res.status(200).json({ success: true, data: enriched });
  } catch (error) {
    console.error("Error in getAllBookings:", error);
    return res.status(500).json({ success: false, error: "Error fetching bookings" });
  }
};

/**
 * GET /api/bookings/:id
 * Here I enforce tenant isolation by querying with (id + hotelId).
 * PRO: I also return paid/charges/due.
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

    const { paid, charges, due } = await prisma.$transaction((tx) =>
      getBookingDueAmount(tx, booking.id, booking.totalPrice)
    );

    return res.status(200).json({
      success: true,
      data: {
        ...booking,
        paidCompleted: paid,
        chargesTotal: charges,
        dueAmount: due,
      },
    });
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

export const moveBookingRoom = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: "Invalid booking ID" });

    const parsed = moveRoomSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        error: "Invalid data",
        details: parsed.error.flatten(),
      });
    }

    const nextRoomId = parsed.data.roomId;

    const updated = await prisma.$transaction(async (tx) => {
      // Load booking inside tenant
      const booking = await tx.booking.findFirst({
        where: { id, hotelId },
        include: {
          room: { include: { roomType: true } },
          guest: { select: guestSelect },
          user: { select: userSelect },
        },
      });

      if (!booking) {
        const err: any = new Error("BOOKING_NOT_FOUND");
        err.code = "BOOKING_NOT_FOUND";
        throw err;
      }

      // V2: only allow moves for pending/confirmed
      if (!["pending", "confirmed"].includes(booking.status)) {
        const err: any = new Error("BOOKING_LOCKED");
        err.code = "BOOKING_LOCKED";
        err.details = { status: booking.status };
        throw err;
      }

      // Prevent "move to same room"
      if (booking.roomId === nextRoomId) {
        const err: any = new Error("SAME_ROOM");
        err.code = "SAME_ROOM";
        throw err;
      }

      // Validate target room in same hotel
      const nextRoom = await tx.room.findFirst({
        where: { id: nextRoomId, hotelId },
        include: { roomType: true },
      });

      if (!nextRoom) {
        const err: any = new Error("ROOM_NOT_FOUND");
        err.code = "ROOM_NOT_FOUND";
        throw err;
      }

      if (nextRoom.status === RoomStatus.mantenimiento) {
        const err: any = new Error("ROOM_IN_MAINTENANCE");
        err.code = "ROOM_IN_MAINTENANCE";
        throw err;
      }

      if (!nextRoom.roomType?.basePrice && nextRoom.roomType?.basePrice !== 0) {
        const err: any = new Error("ROOM_TYPE_MISSING_PRICE");
        err.code = "ROOM_TYPE_MISSING_PRICE";
        throw err;
      }

      // Overlap check in target room (exclude current booking)
      const available = await ensureRoomAvailable(
        tx,
        hotelId,
        nextRoomId,
        booking.checkIn,
        booking.checkOut,
        booking.id
      );

      if (!available) {
        const err: any = new Error("ROOM_NOT_AVAILABLE");
        err.code = "ROOM_NOT_AVAILABLE";
        throw err;
      }

      // Recalculate price based on target roomType
      const nights = calculateNights(booking.checkIn, booking.checkOut);
      const totalPrice = nights * (nextRoom.roomType?.basePrice ?? 0);

      // Update booking roomId + price
      const bookingUpdated = await tx.booking.update({
        where: { id: booking.id },
        data: {
          roomId: nextRoomId,
          totalPrice,
        },
        include: {
          room: { include: { roomType: true } },
          guest: { select: guestSelect },
          user: { select: userSelect },
        },
      });

      return bookingUpdated;
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Error in moveBookingRoom:", error);

    if (error?.code === "BOOKING_NOT_FOUND" || error?.message === "BOOKING_NOT_FOUND") {
      return res.status(404).json({ success: false, error: "Booking not found" });
    }

    if (error?.code === "BOOKING_LOCKED" || error?.message === "BOOKING_LOCKED") {
      return res.status(400).json({
        success: false,
        code: "BOOKING_LOCKED",
        error: "This booking can’t be moved in its current status.",
        details: error?.details,
      });
    }

    if (error?.code === "SAME_ROOM" || error?.message === "SAME_ROOM") {
      return res.status(400).json({
        success: false,
        code: "SAME_ROOM",
        error: "Select a different room to move this booking.",
      });
    }

    if (error?.code === "ROOM_NOT_FOUND" || error?.message === "ROOM_NOT_FOUND") {
      return res.status(404).json({ success: false, code: "ROOM_NOT_FOUND", error: "Room not found" });
    }

    if (error?.code === "ROOM_IN_MAINTENANCE" || error?.message === "ROOM_IN_MAINTENANCE") {
      return res.status(400).json({
        success: false,
        code: "ROOM_IN_MAINTENANCE",
        error: "This room is under maintenance and can’t be booked.",
      });
    }

    if (error?.code === "ROOM_TYPE_MISSING_PRICE" || error?.message === "ROOM_TYPE_MISSING_PRICE") {
      return res.status(400).json({
        success: false,
        code: "ROOM_TYPE_MISSING_PRICE",
        error: "Room type base price is required to move this booking.",
      });
    }

    if (error?.code === "ROOM_NOT_AVAILABLE" || error?.message === "ROOM_NOT_AVAILABLE") {
      return res.status(409).json({
        success: false,
        code: "ROOM_NOT_AVAILABLE",
        error: "Room is not available for the selected dates.",
      });
    }

    return res.status(500).json({ success: false, error: "Error moving booking" });
  }
};

/**
 * PATCH /api/bookings/:id/status
 * Here I enforce tenant isolation, validate transitions, set timestamps,
 * block check-out when there is due amount (including CHARGES), and update room status safely.
 *
 * PRO:
 * - On check-in: I auto-create the police stay registration snapshot (if it doesn't exist)
 * - On check-out: I update the stay registration checkedOutAt
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
      // Here I load booking + room + guest so I can create stay registration snapshot when needed.
      const booking = await tx.booking.findFirst({
        where: { id, hotelId },
        include: {
          room: true,
          guest: { select: guestSelect },
        },
      });

      if (!booking) {
        const err: any = new Error("BOOKING_NOT_FOUND");
        err.code = "BOOKING_NOT_FOUND";
        throw err;
      }

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

      /**
       * Here I require a guest for check-in because we want a professional flow:
       * - police registration snapshot
       * - real guest identity per stay
       */
      if (next === "checked_in" && !booking.guestId) {
        const err: any = new Error("GUEST_REQUIRED_FOR_CHECKIN");
        err.code = "GUEST_REQUIRED_FOR_CHECKIN";
        throw err;
      }

      // Here I block check-out when there is still money due (TOTAL + CHARGES - PAID).
      if (next === "checked_out") {
        const { due } = await getBookingDueAmount(tx, booking.id, booking.totalPrice);
        if (due > 0) {
          const err: any = new Error("BOOKING_HAS_DUE");
          err.code = "BOOKING_HAS_DUE";
          err.details = { due };
          throw err;
        }
      }

      // Here I set operational timestamps only once.
      const timestampPatch: Prisma.BookingUpdateInput = {};
      const now = new Date();

      if (next === "checked_in" && !booking.checkedInAt) {
        timestampPatch.checkedInAt = now;
      }

      if (next === "checked_out" && !booking.checkedOutAt) {
        timestampPatch.checkedOutAt = now;
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

      /**
       * Here I auto-create stay registration snapshot on check-in.
       * I only create it if it doesn't exist (bookingId is unique).
       */
      if (next === "checked_in") {
        const existingReg = await tx.stayRegistration.findUnique({
          where: { bookingId: bookingUpdated.id },
        });

        if (!existingReg) {
          const g = bookingUpdated.guest;

          if (!g) {
            // This should not happen due to the guest required check above,
            // but I keep it as a hard safety net.
            const err: any = new Error("GUEST_REQUIRED_FOR_CHECKIN");
            err.code = "GUEST_REQUIRED_FOR_CHECKIN";
            throw err;
          }

          await tx.stayRegistration.create({
            data: {
              hotelId,
              bookingId: bookingUpdated.id,
              roomId: bookingUpdated.roomId,
              guestId: bookingUpdated.guestId,
              createdById: req.user?.id ?? null,

              // Snapshot fields (guest identity)
              guestName: g.name,
              guestEmail: g.email ?? null,
              guestPhone: g.phone ?? null,

              documentType: (g as any).documentType ?? null,
              documentNumber: g.documentNumber ?? null,
              nationality: (g as any).nationality ?? null,
              birthDate: (g as any).birthDate ?? null,
              gender: (g as any).gender ?? null,
              address: g.address ?? null,
              city: (g as any).city ?? null,
              country: (g as any).country ?? null,

              // Snapshot dates (scheduled + operational)
              scheduledCheckIn: bookingUpdated.checkIn,
              scheduledCheckOut: bookingUpdated.checkOut,
              checkedInAt: bookingUpdated.checkedInAt ?? null,
              checkedOutAt: bookingUpdated.checkedOutAt ?? null,
            },
          });
        }
      }

      /**
       * Here I update stay registration on check-out (if it exists).
       * This keeps the police record aligned with operational reality.
       */
      if (next === "checked_out") {
        const reg = await tx.stayRegistration.findUnique({
          where: { bookingId: bookingUpdated.id },
        });

        if (reg) {
          await tx.stayRegistration.update({
            where: { id: reg.id },
            data: {
              checkedOutAt: bookingUpdated.checkedOutAt ?? new Date(),
            },
          });
        }
      }

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

    // Here I return a clear error when check-in requires a guest.
    if (error?.code === "GUEST_REQUIRED_FOR_CHECKIN" || error?.message === "GUEST_REQUIRED_FOR_CHECKIN") {
      return res.status(400).json({
        success: false,
        code: "GUEST_REQUIRED_FOR_CHECKIN",
        error: "A guest is required to perform check-in.",
      });
    }

    //  Here I return a clear error when check-out is blocked due to pending balance (including charges).
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
