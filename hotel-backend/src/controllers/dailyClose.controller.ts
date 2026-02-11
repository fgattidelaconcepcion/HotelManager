import type { Response } from "express";
import prisma from "../services/prisma";
import type { AuthRequest } from "../middlewares/authMiddleware";
import { auditLog } from "../services/audit.service";

/**
 * Here I parse "YYYY-MM-DD" and return a UTC day range [start, end).
 * I use UTC boundaries to avoid timezone shifting issues across environments.
 */
function getUTCDayRange(dateKey: string): { start: Date; end: Date } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!m) throw new Error("Invalid date-only format");

  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);

  // Start of day UTC
  const start = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
  // Next day start UTC
  const end = new Date(Date.UTC(y, mo - 1, d + 1, 0, 0, 0, 0));

  return { start, end };
}

/**
 * Here I normalize a Date into "YYYY-MM-DD" in UTC.
 * This is what we store as dateKey.
 */
function toUTCDateKey(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Here I decide what "completed" means in a robust way.
 * Your DB stores Payment.status as String, so I accept both:
 * - "completed"
 * - "Completed"
 */
const COMPLETED_STATUSES = ["completed", "Completed"] as const;

/**
 * GET /api/daily-close/preview?date=YYYY-MM-DD
 *
 * Here I compute (without saving) the daily close totals:
 * - sum of COMPLETED payments created that day (hotel-scoped)
 * - breakdown by method
 *
 * Option A: cash closing based on real completed payments.
 */
export const previewDailyClose = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const dateKey = String(req.query.date ?? "").trim() || toUTCDateKey(new Date());

    let start: Date;
    let end: Date;

    try {
      ({ start, end } = getUTCDayRange(dateKey));
    } catch {
      return res.status(400).json({
        success: false,
        code: "INVALID_DATE",
        error: 'Query param "date" is required in format YYYY-MM-DD.',
      });
    }

    // Payment -> Booking -> hotelId (multi-tenant safe)
    const payments = await prisma.payment.findMany({
      where: {
        status: { in: [...COMPLETED_STATUSES] },
        createdAt: { gte: start, lt: end },
        booking: { hotelId },
      },
      select: { amount: true, method: true, status: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const totalCompleted = payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
    const countCompleted = payments.length;

    const byMethod: Record<string, number> = {};
    for (const p of payments) {
      const method = String(p.method ?? "unknown");
      byMethod[method] = (byMethod[method] ?? 0) + Number(p.amount ?? 0);
    }

    return res.status(200).json({
      success: true,
      data: {
        dateKey,
        range: { start, end },
        totalCompleted,
        countCompleted,
        byMethod,
        payments, // optional: useful for auditing UI
      },
    });
  } catch (error) {
    console.error("Error in previewDailyClose:", error);
    return res.status(500).json({ success: false, error: "Error generating daily close preview" });
  }
};

/**
 * POST /api/daily-close
 *
 * Body:
 * - dateKey?: "YYYY-MM-DD" (optional, defaults to today UTC)
 * - notes?: string
 *
 * Here I create an immutable snapshot for the daily close.
 * Only one close per (hotelId + dateKey).
 */
export const createDailyClose = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    const createdById = req.user?.id ?? null;

    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const dateKey = String(req.body?.dateKey ?? "").trim() || toUTCDateKey(new Date());
    const notes = req.body?.notes ? String(req.body.notes) : null;

    let start: Date;
    let end: Date;

    try {
      ({ start, end } = getUTCDayRange(dateKey));
    } catch {
      return res.status(400).json({
        success: false,
        code: "INVALID_DATE",
        error: 'Body "dateKey" must be YYYY-MM-DD.',
      });
    }

    // Here I prevent duplicate closes
    const existing = await prisma.dailyClose.findUnique({
      where: { hotelId_dateKey: { hotelId, dateKey } },
      select: { id: true },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        code: "DAILY_CLOSE_EXISTS",
        error: "A daily close already exists for this date.",
      });
    }

    // Here I recompute totals server-side (never trust client totals)
    const payments = await prisma.payment.findMany({
      where: {
        status: { in: [...COMPLETED_STATUSES] },
        createdAt: { gte: start, lt: end },
        booking: { hotelId },
      },
      select: { amount: true, method: true },
    });

    const totalCompleted = payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
    const countCompleted = payments.length;

    const byMethod: Record<string, number> = {};
    for (const p of payments) {
      const method = String(p.method ?? "unknown");
      byMethod[method] = (byMethod[method] ?? 0) + Number(p.amount ?? 0);
    }

    const created = await prisma.dailyClose.create({
      data: {
        hotelId,
        dateKey,
        totalCompleted,
        countCompleted,
        byMethod,
        createdById,
        notes,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    //  Here I audit daily close creation (money-related and operationally critical).
    await auditLog({
      req,
      hotelId,
      actorUserId: createdById,
      action: "DAILY_CLOSE_CREATED",
      entityType: "DailyClose",
      entityId: created.id,
      metadata: {
        dateKey,
        totalCompleted,
        countCompleted,
        byMethod,
      },
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    console.error("Error in createDailyClose:", error);
    return res.status(500).json({ success: false, error: "Error creating daily close" });
  }
};

/**
 * GET /api/daily-close?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Here I list daily closes for the hotel.
 * - If no range is provided, I return the last 30 closes (most recent first).
 */
export const listDailyCloses = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const fromKey = req.query.from ? String(req.query.from).trim() : "";
    const toKey = req.query.to ? String(req.query.to).trim() : "";

    const where: any = { hotelId };

    // YYYY-MM-DD is lexicographically sortable, so string range works.
    if (fromKey) where.dateKey = { ...(where.dateKey ?? {}), gte: fromKey };
    if (toKey) where.dateKey = { ...(where.dateKey ?? {}), lte: toKey };

    const closes = await prisma.dailyClose.findMany({
      where,
      orderBy: { dateKey: "desc" },
      take: fromKey || toKey ? undefined : 30,
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    return res.status(200).json({ success: true, data: closes });
  } catch (error) {
    console.error("Error in listDailyCloses:", error);
    return res.status(500).json({ success: false, error: "Error fetching daily closes" });
  }
};

/**
 * GET /api/daily-close/:id
 *
 * Here I return a single daily close record scoped by hotel.
 */
export const getDailyCloseById = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const id = Number(req.params.id);
    if (Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: "Invalid daily close ID" });
    }

    const close = await prisma.dailyClose.findFirst({
      where: { id, hotelId },
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (!close) {
      return res.status(404).json({ success: false, error: "Daily close not found" });
    }

    return res.status(200).json({ success: true, data: close });
  } catch (error) {
    console.error("Error in getDailyCloseById:", error);
    return res.status(500).json({ success: false, error: "Error fetching daily close" });
  }
};
