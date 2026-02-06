import type { Response } from "express";
import prisma from "../services/prisma";
import { z } from "zod";
import type { AuthRequest } from "../middlewares/authMiddleware";
import { Prisma } from "@prisma/client";
import { hashPassword } from "../utils/hash";

/**
 * Here I validate profile updates (optional fields),
 * so I can safely accept partial updates from the client.
 */
const updateProfileSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  email: z.string().email().optional(),
});

/**
 * Here I validate employee creation payload.
 * This endpoint is meant for admins to create employees inside their own hotel.
 */
const createEmployeeSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["admin", "receptionist"]).default("receptionist"),
});

const userController = {
  /* =====================
     AUTH PROFILE (SELF)
  ===================== */

  async getProfile(req: AuthRequest, res: Response) {
    try {
      // Here I read auth data from req.user (decoded JWT)
      const userId = req.user?.id;
      const hotelId = req.user?.hotelId;

      if (!userId || !hotelId) {
        return res.status(401).json({ message: "Missing or invalid token" });
      }

      // Here I enforce tenant isolation: user must belong to the same hotelId
      const user = await prisma.user.findFirst({
        where: { id: userId, hotelId },
        select: { id: true, name: true, email: true, role: true, hotelId: true },
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.status(200).json({ user });
    } catch (error) {
      console.error("Error in getProfile:", error);
      return res.status(500).json({ message: "Error fetching profile" });
    }
  },

  async updateProfile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const hotelId = req.user?.hotelId;

      if (!userId || !hotelId) {
        return res.status(401).json({ message: "Missing or invalid token" });
      }

      const parsed = updateProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid data",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      /**
       * Here I enforce tenant isolation on update:
       * I only update if (id + hotelId) matches.
       */
      const existing = await prisma.user.findFirst({
        where: { id: userId, hotelId },
        select: { id: true },
      });

      if (!existing) {
        return res.status(404).json({ message: "User not found" });
      }

      /**
       * Here I prevent email collisions inside the same hotel if user changes email.
       * Because my unique constraint is (hotelId, email), I must validate it manually.
       */
      if (parsed.data.email) {
        const emailTaken = await prisma.user.findFirst({
          where: {
            hotelId,
            email: parsed.data.email,
            NOT: { id: userId },
          },
          select: { id: true },
        });

        if (emailTaken) {
          return res.status(409).json({
            success: false,
            code: "EMAIL_TAKEN",
            message: "This email is already in use in your hotel.",
          });
        }
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: parsed.data,
        select: { id: true, name: true, email: true, role: true, hotelId: true },
      });

      return res.status(200).json({ message: "Profile updated", updated });
    } catch (error) {
      console.error("Error in updateProfile:", error);
      return res.status(500).json({ message: "Error updating profile" });
    }
  },

  /* =====================
     ADMIN: EMPLOYEES
  ===================== */

  /**
   * GET /api/users
   * Admin-only endpoint:
   * - lists all users of the current hotel
   * - supports basic search and pagination
   */
  async listUsers(req: AuthRequest, res: Response) {
    try {
      const hotelId = req.user?.hotelId;
      if (!hotelId) {
        return res.status(401).json({ success: false, error: "Missing hotel context" });
      }

      const search = typeof req.query.search === "string" ? req.query.search : "";
      const pageNum = Number(req.query.page) || 1;
      const limitNum = Number(req.query.limit) || 20;
      const skip = (pageNum - 1) * limitNum;

      /**
       * Here I scope the query by hotelId so I never leak cross-tenant users.
       */
      const where: Prisma.UserWhereInput = {
        hotelId,
      };

      if (search) {
        where.OR = [
          { name: { contains: search } },
          { email: { contains: search } },
        ];
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          orderBy: { name: "asc" },
          skip,
          take: limitNum,
          select: { id: true, name: true, email: true, role: true, hotelId: true, createdAt: true },
        }),
        prisma.user.count({ where }),
      ]);

      return res.status(200).json({
        success: true,
        data: users,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error("Error in listUsers:", error);
      return res.status(500).json({ success: false, error: "Error fetching users" });
    }
  },

  /**
   * POST /api/users
   * Admin-only endpoint:
   * - creates a new employee for the current hotel
   * - enforces unique (hotelId, email)
   */
  async createUser(req: AuthRequest, res: Response) {
    try {
      const hotelId = req.user?.hotelId;
      if (!hotelId) {
        return res.status(401).json({ success: false, error: "Missing hotel context" });
      }

      const parsed = createEmployeeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          code: "VALIDATION_ERROR",
          error: "Invalid data",
          details: parsed.error.flatten(),
        });
      }

      const { name, email, password, role } = parsed.data;

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

      // Here I hash passwords before persisting them
      const hashed = await hashPassword(password);

      const user = await prisma.user.create({
        data: {
          hotelId,
          name,
          email,
          password: hashed,
          role,
        },
        select: { id: true, name: true, email: true, role: true, hotelId: true, createdAt: true },
      });

      return res.status(201).json({ success: true, data: user });
    } catch (error) {
      console.error("Error in createUser:", error);
      return res.status(500).json({ success: false, error: "Error creating user" });
    }
  },

  /**
   * DELETE /api/users/:id
   * Admin-only endpoint:
   * - deletes an employee in the current hotel
   * - blocks deleting yourself for safety
   */
  async deleteUser(req: AuthRequest, res: Response) {
    try {
      const hotelId = req.user?.hotelId;
      const currentUserId = req.user?.id;

      if (!hotelId || !currentUserId) {
        return res.status(401).json({ success: false, error: "Missing hotel context" });
      }

      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, error: "Invalid ID" });
      }

      // Here I prevent an admin from deleting their own account by mistake
      if (id === currentUserId) {
        return res.status(400).json({
          success: false,
          code: "CANNOT_DELETE_SELF",
          error: "I can’t delete my own account.",
        });
      }

      /**
       * Here I enforce tenant isolation:
       * I only delete if the user belongs to the same hotel.
       */
      const user = await prisma.user.findFirst({
        where: { id, hotelId },
        select: { id: true },
      });

      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      await prisma.user.delete({ where: { id } });

      return res.status(200).json({ success: true, message: "User deleted successfully" });
    } catch (error) {
      console.error("Error in deleteUser:", error);
      return res.status(500).json({ success: false, error: "Error deleting user" });
    }
  },
};

export default userController;
