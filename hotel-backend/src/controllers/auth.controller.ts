import { Request, Response } from "express";
import prisma from "../services/prisma";
import { hashPassword, comparePassword } from "../utils/hash";
import { generateToken } from "../utils/jwt";
import { z } from "zod";

// Esquemas de validación
const registerSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["admin", "recepcion"]).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const authController = {
  async register(req: Request, res: Response) {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Datos inválidos",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const { name, email, password, role } = parsed.data;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(400).json({ error: "El email ya está registrado" });
      }

      const hashed = await hashPassword(password);

      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashed,
          role: role || "recepcion",
        },
        select: { id: true, name: true, email: true, role: true },
      });

      return res.status(201).json({
        message: "Usuario creado correctamente",
        user,
      });
    } catch (error) {
      console.error("Error en auth.register:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  },

  async login(req: Request, res: Response) {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Datos inválidos",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const { email, password } = parsed.data;

      const user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      const valid = await comparePassword(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "Contraseña incorrecta" });
      }

      const token = generateToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      return res.status(200).json({
        message: "Login exitoso",
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      console.error("Error en auth.login:", error);
      return res.status(500).json({ error: "Error al iniciar sesión" });
    }
  },
};

export default authController;
