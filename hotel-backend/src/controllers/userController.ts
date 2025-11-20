import { Request, Response } from "express";
import prisma from "../services/prisma";  
import { z } from "zod";

/*
      ESQUEMA PARA ACTUALIZAR PERFIL (si lo necesitas luego)
 */
const updateProfileSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  email: z.string().email().optional(),
});

/* 
      CONTROLADOR DE USUARIO
*/
const userController = {
  // Obtener perfil
  async getProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ message: "Token inválido o ausente" });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, role: true },
      });

      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      return res.status(200).json({ user });
    } catch (error) {
      console.error(" Error en getProfile:", error);
      return res.status(500).json({ message: "Error al obtener perfil" });
    }
  },

  // (Opcional) Actualizar perfil
  async updateProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;

      const parsed = updateProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Datos inválidos",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: parsed.data,
        select: { id: true, name: true, email: true, role: true },
      });

      return res.status(200).json({ message: "Perfil actualizado", updated });
    } catch (error) {
      console.error(" Error en updateProfile:", error);
      return res.status(500).json({ message: "Error al actualizar perfil" });
    }
  },
};

export default userController;
