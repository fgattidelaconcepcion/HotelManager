import type { Response } from "express";
import prisma from "../services/prisma";
import { BookingStatus, RoomStatus } from "@prisma/client";
import type { AuthRequest } from "../middlewares/authMiddleware";

/**
 * =========================================================
 * TIME HELPERS (CONSISTENT "TODAY" IN MY DASHBOARD TIMEZONE)
 * =========================================================
 *
 * Here I make sure "today" is consistent no matter where the server is deployed.
 * I compute local-day windows in UTC using a fixed timezone offset.
 */

function getTzOffsetMinutes(): number {
  const raw = process.env.DASHBOARD_TZ_OFFSET_MINUTES;
  if (!raw) return -180; // default Uruguay
  const n = Number(raw);
  return Number.isFinite(n) ? n : -180;
}

function getLocalDayPartsForOffset(offsetMinutes: number, now = new Date()) {
  const shifted = new Date(now.getTime() + offsetMinutes * 60_000);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
  };
}

function getDayRangeUTCForOffset(offsetMinutes: number, y: number, m: number, d: number) {
  const startUTC = new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - offsetMinutes * 60_000);
  const endUTC = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - offsetMinutes * 60_000);
  return { startUTC, endUTC };
}

function addDaysUTC(y: number, m: number, d: number, deltaDays: number) {
  const base = new Date(Date.UTC(y, m, d, 12, 0, 0, 0));
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return {
    y: base.getUTCFullYear(),
    m: base.getUTCMonth(),
    d: base.getUTCDate(),
  };
}

function toISODateKeyForOffset(offsetMinutes: number, dateUTC: Date) {
  const shifted = new Date(dateUTC.getTime() + offsetMinutes * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const LATEST_BOOKINGS_TAKE = 5;
const LATEST_PAYMENTS_TAKE = 5;

function parseRangeDays(req: AuthRequest) {
  const raw = req.query.range;
  const n = typeof raw === "string" ? Number(raw) : NaN;
  if (n === 30) return 30;
  return 7;
}

type SeriesPoint = {
  date: string;
  value: number;
};

export const getDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const tzOffsetMinutes = getTzOffsetMinutes();
    const { y: todayY, m: todayM, d: todayD } =
      getLocalDayPartsForOffset(tzOffsetMinutes);

    const { startUTC: todayStartUTC, endUTC: todayEndUTC } =
      getDayRangeUTCForOffset(tzOffsetMinutes, todayY, todayM, todayD);

    const rangeDays = parseRangeDays(req);
    const startLocal = addDaysUTC(todayY, todayM, todayD, -(rangeDays - 1));

    const { startUTC: rangeStartUTC } =
      getDayRangeUTCForOffset(
        tzOffsetMinutes,
        startLocal.y,
        startLocal.m,
        startLocal.d
      );

    const { endUTC: rangeEndUTC } =
      getDayRangeUTCForOffset(
        tzOffsetMinutes,
        todayY,
        todayM,
        todayD
      );

    const dateKeys: string[] = [];
    for (let i = 0; i < rangeDays; i++) {
      const day = addDaysUTC(startLocal.y, startLocal.m, startLocal.d, i);
      dateKeys.push(
        `${day.y}-${String(day.m + 1).padStart(2, "0")}-${String(day.d).padStart(2, "0")}`
      );
    }

    /**
     * 🚨 IMPORTANT FIX FOR RAILWAY
     *
     * Here I use prisma.$transaction instead of Promise.all.
     * This guarantees all queries use a single DB connection.
     * It prevents pool exhaustion and 502 errors in Railway.
     */

    const [
      totalRooms,
      maintenanceRooms,
      completedPaymentsAgg,
      pendingBookingsCount,
      pendingPaymentsCount,
      occupiedRoomsTodayDistinct,
      arrivalsToday,
      departuresToday,
      latestBookings,
      latestPayments,
      completedPaymentsInRange,
      checkedInBookingsInRange,
    ] = await prisma.$transaction([
      prisma.room.count({ where: { hotelId } }),

      prisma.room.count({
        where: { hotelId, status: RoomStatus.mantenimiento },
      }),

      prisma.payment.aggregate({
        where: { status: "completed", booking: { hotelId } },
        _sum: { amount: true },
      }),

      prisma.booking.count({
        where: { hotelId, status: "pending" },
      }),

      prisma.payment.count({
        where: { status: "pending", booking: { hotelId } },
      }),

      prisma.booking.findMany({
        where: {
          hotelId,
          status: "checked_in",
          checkIn: { lte: todayEndUTC },
          checkOut: { gte: todayStartUTC },
        },
        select: { roomId: true },
        distinct: ["roomId"],
      }),

      prisma.booking.count({
        where: {
          hotelId,
          status: { in: ["pending", "confirmed"] as BookingStatus[] },
          checkIn: { gte: todayStartUTC, lte: todayEndUTC },
        },
      }),

      prisma.booking.count({
        where: {
          hotelId,
          status: { in: ["checked_in", "checked_out"] as BookingStatus[] },
          checkOut: { gte: todayStartUTC, lte: todayEndUTC },
        },
      }),

      prisma.booking.findMany({
        where: { hotelId },
        orderBy: { createdAt: "desc" },
        take: LATEST_BOOKINGS_TAKE,
      }),

      prisma.payment.findMany({
        where: { status: "completed", booking: { hotelId } },
        orderBy: { createdAt: "desc" },
        take: LATEST_PAYMENTS_TAKE,
      }),

      prisma.payment.findMany({
        where: {
          status: "completed",
          createdAt: { gte: rangeStartUTC, lte: rangeEndUTC },
          booking: { hotelId },
        },
        select: { amount: true, createdAt: true },
      }),

      prisma.booking.findMany({
        where: {
          hotelId,
          status: "checked_in",
          checkIn: { lte: rangeEndUTC },
          checkOut: { gte: rangeStartUTC },
        },
        select: { roomId: true, checkIn: true, checkOut: true },
      }),
    ]);

    const availableRooms = Math.max(0, totalRooms - maintenanceRooms);
    const occupiedRoomsToday = occupiedRoomsTodayDistinct.length;

    const occupancyRate =
      availableRooms > 0
        ? Math.round((occupiedRoomsToday / availableRooms) * 100)
        : 0;

    const totalRevenue = completedPaymentsAgg._sum.amount ?? 0;

    const revenueMap = new Map<string, number>();
    for (const p of completedPaymentsInRange) {
      const key = toISODateKeyForOffset(tzOffsetMinutes, p.createdAt);
      revenueMap.set(key, (revenueMap.get(key) ?? 0) + (p.amount ?? 0));
    }

    const revenueSeries: SeriesPoint[] = dateKeys.map((k) => ({
      date: k,
      value: revenueMap.get(k) ?? 0,
    }));

    return res.status(200).json({
      success: true,
      data: {
        totalRooms,
        maintenanceRooms,
        availableRooms,
        occupiedRoomsToday,
        occupancyRate,
        totalRevenue,
        pendingBookingsCount,
        pendingPaymentsCount,
        latestBookings,
        latestPayments,
        rangeDays,
        revenueSeries,
        serverNow: new Date().toISOString(),
        tzOffsetMinutes,
      },
    });
  } catch (error) {
    console.error("Error in getDashboard:", error);
    return res.status(500).json({
      success: false,
      error: "Error retrieving dashboard",
    });
  }
};
