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
import reportsRoutes from "./reports.routes";

// Here I protect my auth endpoints against brute force
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";

const router = Router();

/* =========================
   Auth protection (brute force)
========================= */

/**
 * Here I create a strict limiter for login attempts.
 * This makes password guessing much harder.
 */
const loginRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  limit: 15, // 15 attempts / 10 min / IP
  standardHeaders: true,
  legacyHeaders: false,
  message: (req: any) => ({
    success: false,
    code: "TOO_MANY_LOGIN_ATTEMPTS",
    error: "Too many login attempts. Please try again later.",
    requestId: req?.requestId,
  }),
});

/**
 * Here I add an increasing delay after a few login attempts.
 * This complements the hard limiter: even before the cap, attempts get slower.
 */
const loginSlowDown = slowDown({
  windowMs: 10 * 60 * 1000,
  delayAfter: 5, // start slowing down after 5 tries
  delayMs: () => 500, // +500ms per request beyond delayAfter
});

/**
 * Here I create a softer limiter for register-hotel.
 * Registering a hotel is rare, but I still want to prevent abuse.
 * I do NOT add slowDown here to avoid frustrating legitimate signups.
 */
const registerHotelRateLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  limit: 10, // 10 attempts / 30 min / IP
  standardHeaders: true,
  legacyHeaders: false,
  message: (req: any) => ({
    success: false,
    code: "TOO_MANY_SIGNUP_ATTEMPTS",
    error: "Too many signup attempts. Please try again later.",
    requestId: req?.requestId,
  }),
});

/* =========================
   Public routes
========================= */

/**
 * POST /api/auth/register-hotel
 * Here I create a brand-new hotel tenant + its first admin.
 */
router.post(
  "/auth/register-hotel",
  registerHotelRateLimiter,
  authController.registerHotel
);

/**
 * POST /api/auth/login
 * Here I log in by hotelCode + email + password.
 */
router.post("/auth/login", loginRateLimiter, loginSlowDown, authController.login);

/* =========================
   Protected routes
========================= */

/**
 * Here I protect everything below with JWT auth.
 */
router.use(authMiddleware);

/**
 * POST /api/auth/register
 * Here I let an admin create employees inside the same hotel.
 */
router.post("/auth/register", authorizeRoles("admin"), authController.register);

/**
 * GET /api/auth/me
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
router.use("/reports", reportsRoutes);
/**
 * Hotel settings (tenant metadata for RIHP exports)
 */
router.use("/hotel", hotelRoutes);


/**
 * New modules
 */
router.use("/charges", chargesRoutes);
router.use("/", stayRegistrationRoutes);

export default router;
