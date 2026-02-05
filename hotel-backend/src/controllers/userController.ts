import { Request, Response } from "express";
import prisma from "../services/prisma";
import { z } from "zod";

/**
 * Here I validate profile updates (optional fields),
 * so I can safely accept partial updates from the client.
 */
const updateProfileSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  email: z.string().email().optional(),
});

const userController = {
  // GET /api/users/me (example)
  async getProfile(req: Request, res: Response) {
    try {
      // Here I read the authenticated user from the JWT middleware (req.user)
      const userId = (req as any).user?.id;

      // Here I block access if the token is missing or invalid
      if (!userId) {
        return res.status(401).json({ message: "Missing or invalid token" });
      }

      // Here I fetch only safe fields (I never expose password)
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, role: true },
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

  // PUT /api/users/me (optional)
  async updateProfile(req: Request, res: Response) {
    try {
      // Here I read the authenticated user id from req.user
      const userId = (req as any).user?.id;

      // Here I validate the payload before updating
      const parsed = updateProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid data",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      // Here I update only the provided fields (partial update)
      const updated = await prisma.user.update({
        where: { id: userId },
        data: parsed.data,
        select: { id: true, name: true, email: true, role: true },
      });

      return res.status(200).json({ message: "Profile updated", updated });
    } catch (error) {
      console.error("Error in updateProfile:", error);
      return res.status(500).json({ message: "Error updating profile" });
    }
  },
};

export default userController;
