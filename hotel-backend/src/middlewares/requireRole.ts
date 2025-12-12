import { Request, Response, NextFunction } from "express";

export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user; // viene del middleware de auth

    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    next();
  };
}
