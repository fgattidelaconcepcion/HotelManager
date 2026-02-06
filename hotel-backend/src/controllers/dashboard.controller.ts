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
 * I compute local-day windows in UTC using a fixed timezone offset (e.g. Uruguay -03:00).
 *
 * ENV:
 *   DASHBOARD_TZ_OFFSET_MINUTES=-180
 */
function getTzOffsetMinutes(): number {
  const raw = process.env.DASHBOARD_TZ_OFFSET_MINUTES;
  // Here I default to Uruguay (-03:00) if no env var is provided
  if (!raw) return -180;
  const n = Number(raw);
  return Number.isFinite(n) ? n : -180;
}

/**
 * Here I convert "now" into the dashboard "local" day parts (y/m/d) using the offset.
 */
function getLocalDayPartsForOffset(offsetMinutes: number, now = new Date()) {
  const shifted = new Date(now.getTime() + offsetMinutes * 60_000);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate();
  return { y, m, d };
}

/**
 * Here I build the UTC range [start,end] that matches a given local day in the offset timezone.
 */
function getDayRangeUTCForOffset(offsetMinutes: number, y: number, m: number, d: number) {
  const startUTC = new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - offsetMinutes * 60_000);
  const endUTC = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - offsetMinutes * 60_000);
  return { startUTC, endUTC };
}

/**
 * Here I add days safely using UTC noon to avoid edge-case date shifts.
 */
function addDaysUTC(y: number, m: number, d: number, deltaDays: number) {
  const base = new Date(Date.UTC(y, m, d, 12, 0, 0, 0)); // noon avoids DST/edge bugs
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return { y: base.getUTCFullYear(), m: base.getUTCMonth(), d: base.getUTCDate() };
}

/**
 * Here I convert an UTC timestamp into a "local date key" (YYYY-MM-DD) in my dashboard timezone.
 * I use this for chart grouping by day.
 */
function toISODateKeyForOffset(offsetMinutes: number, dateUTC: Date) {
  const shifted = new Date(dateUTC.getTime() + offsetMinutes * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const LATEST_BOOKINGS_TAKE = 5;
const LATEST_PAYMENTS_TAKE = 5;

/**
 * Here I safely parse the dashboard range (?range=7|30). Default is 7 days.
 */
function parseRangeDays(req: AuthRequest) {
  const raw = req.query.range;
  const n = typeof raw === "string" ? Number(raw) : NaN;
  if (n === 30) return 30;
  return 7;
}

type SeriesPoint = {
  date: string; // YYYY-MM-DD in dashboard tz
  value: number;
};

export const getDashboard = async (req: AuthRequest, res: Response) => {
  try {
    /**
     * Here I enforce multi-tenant isolation:
     * every metric must be scoped by req.user.hotelId.
     */
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    // Here I decide what timezone offset I’ll use for the whole dashboard
    const tzOffsetMinutes = getTzOffsetMinutes();

    // Here I compute "today" in my dashboard timezone (not the server timezone)
    const { y: todayY, m: todayM, d: todayD } = getLocalDayPartsForOffset(
      tzOffsetMinutes,
      new Date()
    );

    // Here I compute the UTC window that represents "today" in my dashboard timezone
    const { startUTC: todayStartUTC, endUTC: todayEndUTC } = getDayRangeUTCForOffset(
      tzOffsetMinutes,
      todayY,
      todayM,
      todayD
    );

    // Here I compute the UTC window for charts (last 7 or 30 local days)
    const rangeDays = parseRangeDays(req);
    const startLocal = addDaysUTC(todayY, todayM, todayD, -(rangeDays - 1)); // inclusive start

    const { startUTC: rangeStartUTC } = getDayRangeUTCForOffset(
      tzOffsetMinutes,
      startLocal.y,
      startLocal.m,
      startLocal.d
    );
    const { endUTC: rangeEndUTC } = getDayRangeUTCForOffset(
      tzOffsetMinutes,
      todayY,
      todayM,
      todayD
    );

    // Here I prebuild local date keys so I can return a stable chart series with no missing days
    const dateKeys: string[] = [];
    for (let i = 0; i < rangeDays; i++) {
      const day = addDaysUTC(startLocal.y, startLocal.m, startLocal.d, i);
      const key = `${day.y}-${String(day.m + 1).padStart(2, "0")}-${String(day.d).padStart(
        2,
        "0"
      )}`;
      dateKeys.push(key);
    }

    /**
     * Here I fetch everything in parallel to keep the endpoint fast.
     * IMPORTANT: I always scope by hotelId.
     *
     * Note: Payment does NOT have hotelId, so I scope payments via:
     * Payment -> booking -> hotelId
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
    ] = await Promise.all([
      prisma.room.count({
        where: { hotelId },
      }),

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

      // Here I count occupied rooms today using distinct roomId (only checked_in and overlapping today)
      prisma.booking.findMany({
        where: {
          hotelId,
          status: "checked_in",
          checkIn: { lte: todayEndUTC },
          checkOut: { gte: todayStartUTC },
        },
        select: { roomId: true, checkIn: true, checkOut: true },
        distinct: ["roomId"],
      }),

      // Here I count arrivals today (pending/confirmed with checkIn within today's window)
      prisma.booking.count({
        where: {
          hotelId,
          status: { in: ["pending", "confirmed"] as BookingStatus[] },
          checkIn: { gte: todayStartUTC, lte: todayEndUTC },
        },
      }),

      // Here I count departures today (checked_in/checked_out with checkOut within today's window)
      prisma.booking.count({
        where: {
          hotelId,
          status: { in: ["checked_in", "checked_out"] as BookingStatus[] },
          checkOut: { gte: todayStartUTC, lte: todayEndUTC },
        },
      }),

      // Here I fetch the latest bookings for a dashboard widget (scoped by hotelId)
      prisma.booking.findMany({
        where: { hotelId },
        orderBy: { createdAt: "desc" },
        take: LATEST_BOOKINGS_TAKE,
        select: {
          id: true,
          status: true,
          checkIn: true,
          checkOut: true,
          totalPrice: true,
          createdAt: true,
          room: { select: { id: true, number: true, floor: true } },
          guest: { select: { id: true, name: true, email: true, phone: true } },
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      }),

      // Here I fetch the latest completed payments (scoped via booking.hotelId)
      prisma.payment.findMany({
        where: { status: "completed", booking: { hotelId } },
        orderBy: { createdAt: "desc" },
        take: LATEST_PAYMENTS_TAKE,
        select: { id: true, amount: true, status: true, createdAt: true, bookingId: true },
      }),

      // Here I fetch completed payments within the range to build the revenue chart
      prisma.payment.findMany({
        where: {
          status: "completed",
          createdAt: { gte: rangeStartUTC, lte: rangeEndUTC },
          booking: { hotelId },
        },
        select: { amount: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),

      // Here I fetch checked_in bookings overlapping the range to build occupancy charts
      prisma.booking.findMany({
        where: {
          hotelId,
          status: "checked_in",
          checkIn: { lte: rangeEndUTC },
          checkOut: { gte: rangeStartUTC },
        },
        select: { roomId: true, checkIn: true, checkOut: true },
        orderBy: { checkIn: "asc" },
      }),
    ]);

    // Here I compute available rooms (excluding maintenance)
    const availableRooms = Math.max(0, totalRooms - maintenanceRooms);

    // Here I compute today occupancy and occupancy rate
    const occupiedRoomsToday = occupiedRoomsTodayDistinct.length;
    const occupancyRate =
      availableRooms > 0 ? Math.round((occupiedRoomsToday / availableRooms) * 100) : 0;

    // Here I compute total revenue (all-time completed payments)
    const totalRevenue = completedPaymentsAgg._sum.amount ?? 0;

    /**
     * Here I build the revenue series (completed payments grouped by local day key).
     * I return 0 for missing days to keep charts stable.
     */
    const revenueMap = new Map<string, number>();
    for (const p of completedPaymentsInRange) {
      const key = toISODateKeyForOffset(tzOffsetMinutes, p.createdAt);
      revenueMap.set(key, (revenueMap.get(key) ?? 0) + (p.amount ?? 0));
    }

    const revenueSeries: SeriesPoint[] = dateKeys.map((k) => ({
      date: k,
      value: revenueMap.get(k) ?? 0,
    }));

    /**
     * Here I build occupancy series per day:
     * - occupiedRoomsSeries: distinct roomIds overlapping each local day
     * - occupancyRateSeries: occupied / available %
     */
    const occupiedRoomsSeries: SeriesPoint[] = [];
    const occupancyRateSeries: SeriesPoint[] = [];

    for (const dateKey of dateKeys) {
      const [yy, mm, dd] = dateKey.split("-").map(Number);
      const { startUTC, endUTC } = getDayRangeUTCForOffset(tzOffsetMinutes, yy, mm - 1, dd);

      const roomIds = new Set<number>();
      for (const b of checkedInBookingsInRange) {
        if (b.checkIn <= endUTC && b.checkOut >= startUTC) {
          roomIds.add(b.roomId);
        }
      }

      const occupied = roomIds.size;
      occupiedRoomsSeries.push({ date: dateKey, value: occupied });

      const rate = availableRooms > 0 ? Math.round((occupied / availableRooms) * 100) : 0;
      occupancyRateSeries.push({ date: dateKey, value: rate });
    }

    // Here I keep backward compatibility with older UI (activeBookingsCount)
    const activeBookingsCount = occupiedRoomsToday;

    return res.status(200).json({
      success: true,
      data: {
        totalRooms,
        maintenanceRooms,
        availableRooms,

        occupiedRoomsToday,
        occupancyRate,

        activeBookingsCount,

        todaysCheckIns: arrivalsToday,
        todaysCheckOuts: departuresToday,

        totalRevenue,

        pendingBookingsCount,
        pendingPaymentsCount,

        latestBookings,
        latestPayments,

        rangeDays,
        revenueSeries,
        occupiedRoomsSeries,
        occupancyRateSeries,

        // Here I expose debug info to validate timezone logic in production
        serverNow: new Date().toISOString(),
        tzOffsetMinutes,
      },
    });
  } catch (error) {
    console.error("Error en getDashboard:", error);
    return res.status(500).json({ success: false, error: "Error al obtener dashboard" });
  }
};
