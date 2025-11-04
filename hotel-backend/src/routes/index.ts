import { Router } from "express";
import userController from "../controllers/userController";
import { authMiddleware, AuthRequest } from "../middlewares/authMiddleware";
import { PrismaClient } from "@prisma/client";
import roomsRoutes from "./rooms.routes";
import bookingsRoutes from "./bookings.routes";
import roomTypeRoutes from "./roomType.routes";

const prisma = new PrismaClient();
const router = Router();

// Rutas públicas
router.post("/register", userController.register);
router.post("/login", userController.login);

//  Rutas protegidas
router.get("/me", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener el usuario" });
  }
});

//  Subrutas principales
router.use("/rooms", roomsRoutes);
router.use("/bookings", bookingsRoutes);
router.use("/room-types", roomTypeRoutes);
export default router;
