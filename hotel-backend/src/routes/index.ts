import { Router } from "express";

import authController from "../controllers/auth.controller";
import userController from "../controllers/userController";
import { authMiddleware } from "../middlewares/authMiddleware";

import paymentsRoutes from "./payments.routes";
import roomsRoutes from "./rooms.routes";
import bookingsRoutes from "./bookings.routes";
import roomTypeRoutes from "./roomType.routes";
import guestRoutes from "./guest.routes";

const router = Router();

/* =========================
   Public routes
========================= */
router.post("/auth/register", authController.register);
router.post("/auth/login", authController.login);

/* =========================
   Protected routes
   (everything below requires JWT)
========================= */
router.use(authMiddleware);

/**
 * Auth / profile
 */
router.get("/auth/me", userController.getProfile);

/**
 * Domain routes
 */
router.use("/rooms", roomsRoutes);
router.use("/bookings", bookingsRoutes);
router.use("/room-types", roomTypeRoutes);
router.use("/guests", guestRoutes);
router.use("/payments", paymentsRoutes);

export default router;
