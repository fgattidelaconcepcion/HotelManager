import type { Response, NextFunction, Request } from "express";
import { verifyToken, type UserRole, type TokenPayload } from "../utils/jwt";

/**
 * Here I extend Express Request to include the authenticated user.
 */
export interface AuthRequest extends Request {
  user?: TokenPayload;
  requestId?: string;
}

/**
 * Here I extract the Bearer token from the Authorization header.
 * Format: "Authorization: Bearer <token>"
 */
function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) return null;

  return token;
}

/**
 * Authentication middleware:
 * - Reads JWT from Authorization header
 * - Verifies and decodes it
 * - Attaches user info to req.user
 * - Blocks unauthenticated requests
 */
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      code: "AUTH_TOKEN_MISSING",
      error: "Unauthorized: token not provided",
      requestId: req.requestId,
    });
  }

  try {
    const decoded = verifyToken(token);

    // Here I validate minimum required fields to protect against malformed tokens.
    if (!decoded?.id || !decoded?.hotelId || !decoded?.email || !decoded?.role) {
      return res.status(401).json({
        success: false,
        code: "AUTH_TOKEN_INVALID",
        error: "Invalid token payload",
        requestId: req.requestId,
      });
    }

    req.user = decoded;
    return next();
  } catch (err: any) {
    const isExpired = err?.name === "TokenExpiredError";

    return res.status(401).json({
      success: false,
      code: isExpired ? "AUTH_TOKEN_EXPIRED" : "AUTH_TOKEN_INVALID",
      error: isExpired ? "Token expired" : "Invalid token",
      requestId: req.requestId,
    });
  }
}

/**
 * I export the UserRole type so other middlewares (authorizeRoles) can reuse it.
 */
export type { UserRole };
