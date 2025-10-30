import { Request, Response } from "express";
import prisma from "../utils/prisma";
import { hashPassword, comparePassword } from "../utils/hash";
import { generateToken } from "../utils/jwt";

const userController = {
  register: async (req: Request, res: Response) => {
    try {
      const { name, email, password, role } = req.body;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(400).json({ message: "El email ya está registrado" });
      }

      const hashed = await hashPassword(password);

      const user = await prisma.user.create({
        data: { name, email, password: hashed, role },
      });

      return res.status(201).json({ message: "Usuario creado", user });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  },

  login: async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

      const valid = await comparePassword(password, user.password);
      if (!valid) return res.status(401).json({ message: "Contraseña incorrecta" });

      const token = generateToken({ id: user.id, role: user.role });

      return res.status(200).json({ message: "Login exitoso", token });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  },
};

export default userController;
