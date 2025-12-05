// src/routes/index.ts
import { Router } from "express";
import authController from "../controllers/auth.controller";
import userController from "../controllers/userController";
import { authMiddleware } from "../middlewares/authMiddleware";
import paymentsRoutes from "./payments.routes";


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
/* 
     
 */
// ⚠️ Después, cuando tengas login funcionando, volvemos a poner authMiddleware.
router.use("/rooms", roomsRoutes);
router.use("/bookings", bookingsRoutes);
router.use("/room-types", roomTypeRoutes);
router.use("/guests", guestRoutes);
router.use("/payments", paymentsRoutes);
;

export default router;
