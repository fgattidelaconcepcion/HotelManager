import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

/**
 * Here I load the JWT secret from environment variables.
 * I fail fast if it is not configured, because auth must never run without it.
 */
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set in environment variables");
}

/**
 * Here I define the roles allowed in my application.
 * I use this type for authorization and role checks.
 */
export type UserRole = "admin" | "receptionist";

/**
 * Here I describe the structure of the decoded JWT payload.
 * This helps me keep strong typing across the app.
 */
export interface AuthUser extends JwtPayload {
  id: number;
  email: string;
  role: UserRole;
  name?: string;
}

/**
 * Here I extend Express Request to include the authenticated user.
 */
export interface AuthRequest extends Request {
  user?: AuthUser;
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
export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // Here I try to read the Bearer token from the request
  const token = getBearerToken(req);

  // Here I block the request if no token is provided
  if (!token) {
    return res.status(401).json({
      success: false,
      code: "AUTH_TOKEN_MISSING",
      error: "Unauthorized: token not provided",
    });
  }

  try {
    // Here I verify and decode the JWT using the secret
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;

    /**
     * Here I validate that the token contains the minimum required fields.
     * This prevents malformed or tampered tokens from being accepted.
     */
    if (!decoded || typeof decoded !== "object" || !decoded.role || !decoded.email) {
      return res.status(401).json({
        success: false,
        code: "AUTH_TOKEN_INVALID",
        error: "Invalid token",
      });
    }

    // Here I attach the authenticated user to the request object
    req.user = decoded;

    // Here I allow the request to continue to the next middleware/controller
    return next();
  } catch (err: any) {
    /**
     * Here I distinguish between expired tokens and other invalid tokens
     * to return clearer error messages to the client.
     */
    const code =
      err?.name === "TokenExpiredError"
        ? "AUTH_TOKEN_EXPIRED"
        : "AUTH_TOKEN_INVALID";

    return res.status(401).json({
      success: false,
      code,
      error:
        err?.name === "TokenExpiredError"
          ? "Token expired"
          : "Invalid token",
    });
  }
};
