import type { Response } from "express";
import prisma from "../services/prisma";
import type { AuthRequest } from "../middlewares/authMiddleware";

/**
 * Parse "YYYY-MM-DD" as UTC noon to avoid timezone shift problems.
 * This is the same strategy used in bookings.controller.ts.
 */
function parseDateOnlyToUTCNoon(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) throw new Error("Invalid date-only format");
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0));
}

/**
 * GET /api/planning?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns:
 * - rooms for current hotel (planning rows)
 * - bookings that overlap the requested window (planning blocks)
 *
 * Multi-tenant safe: everything is scoped by req.user.hotelId.
 */
export const getPlanning = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const fromRaw = String(req.query.from ?? "").trim();
    const toRaw = String(req.query.to ?? "").trim();

    if (!fromRaw || !toRaw) {
      return res.status(400).json({
        success: false,
        code: "INVALID_DATES",
        error: 'Query params "from" and "to" are required (YYYY-MM-DD).',
      });
    }

    let from: Date;
    let to: Date;

    try {
      from = parseDateOnlyToUTCNoon(fromRaw);
      to = parseDateOnlyToUTCNoon(toRaw);
    } catch {
      return res.status(400).json({
        success: false,
        code: "INVALID_DATES",
        error: "Invalid date format. Use YYYY-MM-DD.",
      });
    }

    if (to <= from) {
      return res.status(400).json({
        success: false,
        code: "INVALID_DATES",
        error: "The 'to' date must be after 'from'.",
      });
    }

    // Rooms = rows
    const rooms = await prisma.room.findMany({
      where: { hotelId },
      orderBy: [{ floor: "asc" }, { number: "asc" }],
      include: { roomType: true },
    });

    /**
     * Bookings = blocks
     * Overlap rule:
     * - checkIn < to
     * - checkOut > from
     */
    const bookings = await prisma.booking.findMany({
      where: {
        hotelId,
        status: { not: "cancelled" },
        checkIn: { lt: to },
        checkOut: { gt: from },
      },
      orderBy: [{ roomId: "asc" }, { checkIn: "asc" }],
      include: {
        guest: { select: { id: true, name: true } },
        room: { select: { id: true, number: true, floor: true } },
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        from: fromRaw,
        to: toRaw,
        rooms,
        bookings,
      },
    });
  } catch (error) {
    console.error("Error in getPlanning:", error);
    return res.status(500).json({ success: false, error: "Error fetching planning" });
  }
};
