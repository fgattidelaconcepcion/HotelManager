import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../utils/prisma";
import { authMiddleware, AuthRequest } from "../middlewares/authMiddleware";
import { authorizeRoles } from "../middlewares/roleMiddleware";

const router = Router();

// Verificación obligatoria del secreto JWT
if (!process.env.JWT_SECRET) {
  throw new Error(" JWT_SECRET no está definido en el archivo .env");
}
const JWT_SECRET = process.env.JWT_SECRET!;

/* ------------------ REGISTRO ------------------ */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validaciones básicas
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Nombre, email y contraseña son requeridos" });
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ error: "Formato de email inválido" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    }

    // Evitar duplicados
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "El email ya está registrado" });
    }

    // Hashear contraseña
    const hashed = await bcrypt.hash(password, 10);

    // Crear usuario
    const user = await prisma.user.create({
      data: { name, email, password: hashed, role: role || "recepcion" },
      select: { id: true, name: true, email: true, role: true },
    });

    res.status(201).json({
      message: "Usuario creado correctamente",
      user,
    });
  } catch (err) {
    console.error(" Error en /register:", err);
    res.status(500).json({ error: "Error al registrar usuario" });
  }
});

/*  LOGIN  */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email y contraseña son requeridos" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Contraseña incorrecta" });

    // Generar JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login exitoso",
      token,
      expiresIn: "7d",
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error(" Error en /login:", err);
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
});

/*  PERFIL DE USUARIO  */
router.get("/me", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    res.json(user);
  } catch (err) {
    console.error(" Error en /me:", err);
    res.status(500).json({ error: "Error al obtener el usuario" });
  }
});

/* LISTAR USUARIOS (SOLO ADMIN)  */
router.get("/users", authMiddleware, authorizeRoles("admin"), async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true },
      orderBy: { id: "asc" },
    });

    res.json(users);
  } catch (err) {
    console.error(" Error en /users:", err);
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
});

export default router;
