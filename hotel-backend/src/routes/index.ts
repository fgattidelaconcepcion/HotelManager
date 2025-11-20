// src/routes/index.ts
import { Router } from "express";
import authController from "../controllers/auth.controller";
import userController from "../controllers/userController";
import { authMiddleware } from "../middlewares/authMiddleware";

// Sub-rutas
import roomsRoutes from "./rooms.routes";
import bookingsRoutes from "./bookings.routes";
import roomTypeRoutes from "./roomType.routes";
import guestRoutes from "./guest.routes";

const router = Router();

/* 
      RUTAS PÚBLICAS
 */
router.post("/auth/register", authController.register);
router.post("/auth/login", authController.login);

/* 
      PERFIL DE USUARIO
*/
router.get("/auth/me", authMiddleware, userController.getProfile);

/* 
      RUTAS PRIVADAS
 */
router.use("/rooms", authMiddleware, roomsRoutes);
router.use("/bookings", authMiddleware, bookingsRoutes);
router.use("/room-types", authMiddleware, roomTypeRoutes);
router.use("/guests", authMiddleware, guestRoutes);

export default router;
