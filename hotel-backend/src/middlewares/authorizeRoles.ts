import type { Response, NextFunction } from "express";
import type { AuthRequest, UserRole } from "./authMiddleware";

/**
 * Role-based authorization middleware factory.
 *
 * Here I generate a middleware that only allows users
 * whose role is included in the "allowed" list.
 */
export function authorizeRoles(...allowed: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // Here I read the authenticated user injected by authMiddleware
    const user = req.user;

    // Here I block access if the user is not authenticated
    if (!user) {
      return res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        error: "Unauthorized",
      });
    }

    // Here I enforce RBAC by checking if the user's role is allowed
    if (!allowed.includes(user.role)) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        error: "Forbidden",
      });
    }

    // Here I allow the request to continue if authorization succeeds
    return next();
  };
}
