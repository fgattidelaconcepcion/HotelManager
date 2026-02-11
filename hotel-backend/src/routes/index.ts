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
import chargesRoutes from "./charges.routes";
import stayRegistrationRoutes from "./stayRegistration.routes";
import planningRoutes from "./planning.routes";
import dailyCloseRoutes from "./dailyClose.routes";
import hotelRoutes from "./hotel.routes";

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
router.use("/planning", planningRoutes);
router.use("/daily-close", dailyCloseRoutes);

/**
 * Hotel settings (tenant metadata for RIHP exports)
 * Routes:
 * - GET  /api/hotel/me
 * - PUT  /api/hotel/me   (admin only inside hotel.routes)
 */
router.use("/hotel", hotelRoutes);

/**
 * New modules:
 * - Charges (consumption/extras)
 * - Police stay registration + report export
 *
 * IMPORTANT:
 * stayRegistrationRoutes contains routes like:
 * - POST   /bookings/:id/stay-registration
 * - GET    /reports/police              (CSV)
 * - GET    /reports/police/pdf          (PDF list)
 * - GET    /bookings/:id/stay-registration/pdf    (PDF single booking)
 *
 * So I mount it at "/" to keep those paths exactly as defined.
 */
router.use("/charges", chargesRoutes);
router.use("/", stayRegistrationRoutes);

export default router;
