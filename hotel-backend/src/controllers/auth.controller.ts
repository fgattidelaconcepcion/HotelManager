import type { Request, Response } from "express";
import prisma from "../services/prisma";
import { hashPassword, comparePassword } from "../utils/hash";
import { generateToken } from "../utils/jwt";
import { z } from "zod";
import { auditLog } from "../services/audit.service";

/**
 * Here I validate the public "create hotel + admin" payload.
 * This is the entry point for a brand-new hotel tenant.
 */
const registerHotelSchema = z.object({
  hotelName: z.string().min(2).max(80),
  hotelCode: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/i, "hotelCode must be alphanumeric or hyphen"),
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(6),
});

/**
 * Here I validate the protected "create employee user" payload.
 * I keep it simple: admin can create receptionist (or admin if you want).
 */
const registerUserSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["admin", "receptionist"]).optional(),
});

/**
 * Here I validate login.
 * I require hotelCode to select the tenant.
 */
const loginSchema = z.object({
  hotelCode: z.string().min(2),
  email: z.string().email(),
  password: z.string(),
});

const authController = {
  /**
   * POST /api/auth/register-hotel
   * Public endpoint:
   * - creates a Hotel
   * - creates the first Admin user inside that hotel
   * - creates a default RoomType so rooms can be created right away
   * - returns token + user + hotel
   */
  async registerHotel(req: Request, res: Response) {
    try {
      const parsed = registerHotelSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid data",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      // Here I normalize values to avoid accidental duplicates (case/spacing)
      const hotelName = parsed.data.hotelName.trim();
      const hotelCode = parsed.data.hotelCode.trim().toLowerCase();
      const name = parsed.data.name.trim();
      const email = parsed.data.email.trim().toLowerCase();
      const password = parsed.data.password;

      // Here I prevent duplicate hotel codes (tenant identifiers)
      const existingHotel = await prisma.hotel.findUnique({
        where: { code: hotelCode },
        select: { id: true },
      });

      if (existingHotel) {
        return res.status(409).json({
          success: false,
          code: "HOTEL_CODE_TAKEN",
          error: "Hotel code is already in use",
        });
      }

      // Here I hash the password before saving it
      const hashed = await hashPassword(password);

      /**
       * Here I create hotel + admin + a default room type in a single transaction,
       * so I never end up with a hotel that can't create rooms.
       */
      const created = await prisma.$transaction(async (tx) => {
        const hotel = await tx.hotel.create({
          data: { name: hotelName, code: hotelCode },
        });

        const user = await tx.user.create({
          data: {
            hotelId: hotel.id,
            name,
            email,
            password: hashed,
            role: "admin",
          },
          select: { id: true, name: true, email: true, role: true, hotelId: true },
        });

        // Here I ensure every hotel starts with at least 1 room type.
        await tx.roomType.create({
          data: {
            hotelId: hotel.id,
            name: "Standard",
            basePrice: 1000,
            capacity: 2,
          },
        });

        return { hotel, user };
      });

      // Here I audit the creation of a new hotel tenant (high-value business event).
      await auditLog({
        req,
        hotelId: created.hotel.id,
        actorUserId: created.user.id,
        action: "HOTEL_REGISTERED",
        entityType: "Hotel",
        entityId: created.hotel.id,
        metadata: {
          hotelCode: created.hotel.code,
          hotelName: created.hotel.name,
          adminEmail: created.user.email,
        },
      });

      // Here I embed hotelId in the token so I can scope every request to the tenant
      const token = generateToken({
        id: created.user.id,
        hotelId: created.user.hotelId,
        email: created.user.email,
        role: created.user.role,
        name: created.user.name,
        hotelCode: created.hotel.code,
      });

      return res.status(201).json({
        success: true,
        message: "Hotel and admin created",
        token,
        hotel: created.hotel,
        user: created.user,
      });
    } catch (error) {
      console.error("Error in registerHotel:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },

  /**
   * POST /api/auth/register
   * Protected endpoint (admin only in routes):
   * - creates a user inside the same hotel as the admin
   */
  async register(req: Request, res: Response) {
    try {
      const parsed = registerUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid data",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const admin = (req as any).user as { hotelId?: number; id?: number };
      const hotelId = admin?.hotelId;

      if (!hotelId) {
        return res.status(401).json({
          success: false,
          error: "Missing or invalid token",
        });
      }

      // Here I normalize fields to keep data consistent
      const name = parsed.data.name.trim();
      const email = parsed.data.email.trim().toLowerCase();
      const password = parsed.data.password;
      const role = parsed.data.role;

      // Here I enforce unique email per hotel
      const existing = await prisma.user.findFirst({
        where: { hotelId, email },
        select: { id: true },
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          code: "EMAIL_TAKEN",
          error: "Email is already in use for this hotel",
        });
      }

      const hashed = await hashPassword(password);

      const user = await prisma.user.create({
        data: {
          hotelId,
          name,
          email,
          password: hashed,
          role: role ?? "receptionist",
        },
        select: { id: true, name: true, email: true, role: true, hotelId: true },
      });

      // Here I audit employee creation (important for accountability).
      await auditLog({
        req,
        hotelId,
        actorUserId: admin?.id ?? null,
        action: "EMPLOYEE_CREATED",
        entityType: "User",
        entityId: user.id,
        metadata: {
          createdUserEmail: user.email,
          createdUserRole: user.role,
        },
      });

      return res.status(201).json({
        success: true,
        message: "User created",
        user,
      });
    } catch (error) {
      console.error("Error in register:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },

  /**
   * POST /api/auth/login
   * Public endpoint:
   * - finds hotel by code
   * - finds user by (hotelId + email)
   * - validates password
   * - returns token + user
   */
  async login(req: Request, res: Response) {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid data",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      // Here I normalize inputs to keep auth stable and predictable
      const hotelCode = parsed.data.hotelCode.trim().toLowerCase();
      const email = parsed.data.email.trim().toLowerCase();
      const password = parsed.data.password;

      const hotel = await prisma.hotel.findUnique({
        where: { code: hotelCode },
        select: { id: true, code: true, name: true },
      });

      if (!hotel) {
        /**
         * Important:
         * I cannot write an AuditLog record because AuditLog requires a valid hotelId.
         * If you want to audit "unknown hotelCode", we can add a separate table
         * (e.g. SecurityEvent) that doesn't require hotelId.
         */
        return res.status(401).json({
          success: false,
          code: "HOTEL_NOT_FOUND",
          error: "Invalid hotel code",
        });
      }

      const user = await prisma.user.findFirst({
        where: { hotelId: hotel.id, email },
      });

      if (!user) {
        // Here I audit a failed login attempt (hotel known, user not found).
        await auditLog({
          req,
          hotelId: hotel.id,
          actorUserId: null,
          action: "AUTH_LOGIN_FAIL",
          entityType: "User",
          entityId: null,
          metadata: {
            email,
            reason: "INVALID_CREDENTIALS", // I avoid revealing whether the email exists.
          },
        });

        return res.status(401).json({
          success: false,
          code: "INVALID_CREDENTIALS",
          error: "Invalid credentials",
        });
      }

      const ok = await comparePassword(password, user.password);
      if (!ok) {
        // Here I audit a failed login attempt (wrong password), without leaking specifics.
        await auditLog({
          req,
          hotelId: hotel.id,
          actorUserId: user.id,
          action: "AUTH_LOGIN_FAIL",
          entityType: "User",
          entityId: user.id,
          metadata: {
            email,
            reason: "INVALID_CREDENTIALS",
          },
        });

        return res.status(401).json({
          success: false,
          code: "INVALID_CREDENTIALS",
          error: "Invalid credentials",
        });
      }

      // Here I audit a successful login.
      await auditLog({
        req,
        hotelId: hotel.id,
        actorUserId: user.id,
        action: "AUTH_LOGIN_SUCCESS",
        entityType: "User",
        entityId: user.id,
        metadata: { email },
      });

      const token = generateToken({
        id: user.id,
        hotelId: user.hotelId,
        email: user.email,
        role: user.role,
        name: user.name,
        hotelCode: hotel.code,
      });

      return res.status(200).json({
        success: true,
        message: "Login successful",
        token,
        user: {
          id: user.id,
          hotelId: user.hotelId,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        hotel: {
          id: hotel.id,
          code: hotel.code,
          name: hotel.name,
        },
      });
    } catch (error) {
      console.error("Error in login:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },
};

export default authController;
