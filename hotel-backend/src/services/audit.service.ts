import type { Request } from "express";
import prisma from "./prisma";

/**
 * Here I keep a minimal and safe audit logging layer.
 * My rule is: audit logs must NEVER break the main request.
 */

export type AuditAction =
  | "AUTH_LOGIN_SUCCESS"
  | "AUTH_LOGIN_FAIL"
  | "HOTEL_REGISTERED"
  | "EMPLOYEE_CREATED"
  | "DAILY_CLOSE_CREATED"
  | "PAYMENT_CREATED"
  | "PAYMENT_UPDATED"
  | "PAYMENT_DELETED"
  | "BOOKING_CREATED"
  | "BOOKING_UPDATED"
  | "BOOKING_ROOM_MOVED"
  | "BOOKING_STATUS_CHANGED"
  | "BOOKING_DELETED"
  | "STAY_REGISTRATION_CREATED"
  | "STAY_REGISTRATION_AUTO_CREATED"
  | "CHARGE_CREATED"
  | "CHARGE_UPDATED"
  | "CHARGE_DELETED";

type AuditInput = {
  req?: Request; // <- optional, so audits can be written from non-http contexts
  hotelId: number;
  actorUserId?: number | null;
  action: AuditAction;
  entityType?: string | null;
  entityId?: number | null;
  metadata?: unknown;
};

/**
 * Here I normalize request context so I can trace events later.
 */
function getRequestContext(req?: Request) {
  if (!req) return { ip: null as string | null, userAgent: null as string | null, requestId: null as string | null, path: null as string | null, method: null as string | null };

  const forwardedFor = req.headers["x-forwarded-for"];
  const ip =
    (typeof forwardedFor === "string"
      ? forwardedFor.split(",")[0]?.trim()
      : Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : null) ||
    req.ip ||
    null;

  const userAgent =
    typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null;

  // I set requestId in app.ts, so I reuse it here
  const requestId =
    (req as any).requestId ||
    (typeof req.headers["x-request-id"] === "string" ? req.headers["x-request-id"] : null);

  const path = req.originalUrl || req.url || null;
  const method = req.method || null;

  return { ip, userAgent, requestId, path, method };
}

/**
 * Here I ensure metadata is JSON-safe (Prisma Json type).
 * If it can't be serialized, I fallback to a small note.
 */
function toSafeJson(value: unknown) {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return { note: "metadata_not_serializable" };
  }
}

/**
 * Here I write an audit record.
 * If anything fails (DB locked, bad JSON, etc.) I swallow it and continue.
 */
export async function auditLog(input: AuditInput) {
  try {
    const { req, hotelId, actorUserId, action, entityType, entityId, metadata } = input;

    const ctx = getRequestContext(req);

    // Here I enrich metadata with request basics (useful even without schema columns).
    const safeMetadata = toSafeJson({
      ...(typeof metadata === "object" && metadata !== null ? (metadata as any) : { value: metadata }),
      request: {
        path: ctx.path,
        method: ctx.method,
      },
    });

    await prisma.auditLog.create({
      data: {
        hotelId,
        actorUserId: actorUserId ?? null,
        action,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        metadata: safeMetadata,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      },
    });
  } catch (err) {
    // Here I never break the main request if audit fails.
    console.warn("⚠️ auditLog failed:", err);
  }
}
