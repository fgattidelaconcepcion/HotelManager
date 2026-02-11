import { Router } from "express";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import { getMyHotel, updateMyHotel } from "../controllers/hotel.controller";

const router = Router();

/**
 * Hotel settings (tenant settings)
 *
 * Mounted at: /api/hotel
 * So:
 * - GET  /api/hotel/me
 * - PUT  /api/hotel/me
 */

/**
 * Here I return the current hotel settings for the logged-in user.
 * Roles: admin + receptionist (read-only)
 */
router.get("/me", authorizeRoles("admin", "receptionist"), getMyHotel);

/**
 * Here I update hotel settings (only admin can write).
 * Roles: admin
 */
router.put("/me", authorizeRoles("admin"), updateMyHotel);

export default router;
