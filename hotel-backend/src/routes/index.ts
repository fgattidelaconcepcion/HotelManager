import { Router } from "express";

import authController from "../controllers/auth.controller";
import userController from "../controllers/userController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { authorizeRoles } from "../middlewares/authorizeRoles";

import paymentsRoutes from "./payments.routes";
import roomsRoutes from "./rooms.routes";
import bookingsRoutes from "./bookings.routes";
import roomTypeRoutes from "./roomType.routes";
import guestRoutes from "./guest.routes";
import usersRoutes from "./users.routes";

const router = Router();

/* =========================
   Public routes
========================= */

/**
 * Here I create a brand-new hotel tenant + its first admin.
 */
router.post("/auth/register-hotel", authController.registerHotel);

/**
 * Here I log in by hotelCode + email + password.
 */
router.post("/auth/login", authController.login);

/* =========================
   Protected routes
========================= */

/**
 * Here I protect everything below with JWT auth.
 */
router.use(authMiddleware);

/**
 * Here I let an admin create employees inside the same hotel.
 */
router.post("/auth/register", authorizeRoles("admin"), authController.register);

/**
 * Here I return the current authenticated profile (scoped by hotel).
 */
router.get("/auth/me", userController.getProfile);

/**
 * Domain routes (all protected by authMiddleware above)
 */
router.use("/rooms", roomsRoutes);
router.use("/bookings", bookingsRoutes);
router.use("/room-types", roomTypeRoutes);
router.use("/guests", guestRoutes);
router.use("/payments", paymentsRoutes);
router.use("/users", usersRoutes);

export default router;
