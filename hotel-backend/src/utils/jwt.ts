import jwt from "jsonwebtoken";
import { env } from "../config/env";

/**
 * Here I define the roles allowed in my application.
 * I keep it aligned with Prisma enum UserRole.
 */
export type UserRole = "admin" | "receptionist";

export type TokenPayload = {
  id: number;
  hotelId: number;
  email: string;
  role: UserRole;
  name?: string;
  hotelCode?: string;
};

/**
 * Here I generate a signed JWT for the authenticated user.
 * I keep an expiration to reduce risk if a token leaks.
 */
export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "7d" });
}

/**
 * Here I verify and decode a JWT.
 * I keep the return type strict so downstream code is safer.
 */
export function verifyToken(token: string): TokenPayload & jwt.JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload & jwt.JwtPayload;
}
