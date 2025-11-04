import { Request, Response } from "express";
import prisma from "../utils/prisma";
import { hashPassword, comparePassword } from "../utils/hash";
import { generateToken } from "../utils/jwt";
import { z } from "zod";

//  Esquemas de validación con Zod
const registerSchema = z.object({
  name: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(50, "El nombre no puede superar los 50 caracteres"),
  email: z
    .string()
    .email("Formato de email inválido")
    .nonempty("El email es requerido"),
  password: z
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres")
    .nonempty("La contraseña es requerida"),
  role: z.enum(["admin", "recepcion"]).optional(),
});

const loginSchema = z.object({
  email: z
    .string()
    .email("Formato de email inválido")
    .nonempty("El email es requerido"),
  password: z
    .string()
    .nonempty("La contraseña es requerida"),
});


const userController = {
  //  Registrar usuario
  async register(req: Request, res: Response) {
    try {
      const result = registerSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          message: "Datos inválidos",
          errors: result.error.flatten().fieldErrors,
        });
      }

      const { name, email, password, role } = result.data;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(400).json({ message: "El email ya está registrado" });
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
      console.error(" Error en register:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  },

  //  Login
  async login(req: Request, res: Response) {
    try {
      const result = loginSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          message: "Datos inválidos",
          errors: result.error.flatten().fieldErrors,
        });
      }

      const { email, password } = result.data;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      const valid = await comparePassword(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Contraseña incorrecta" });
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
      console.error(" Error en login:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  },

  //  Obtener perfil del usuario autenticado
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
      console.error("❌ Error en getProfile:", error);
      return res.status(500).json({ message: "Error al obtener perfil" });
    }
  },
};

export default userController;
