import { Router } from "express";
import {
  getAllGuests,
  getGuestById,
  createGuest,
  updateGuest,
  deleteGuest,
} from "../controllers/guest.controller";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import { validateIdParam } from "../middlewares/validateIdParam";

const router = Router();

/**
 * GUESTS
 * - admin: full CRUD
 * - receptionist: full CRUD (more practical at the front desk)
 *
 * Note: Multi-tenant isolation is still enforced in the controller using req.user.hotelId.
 */

/**
 * READ: admin + receptionist
 */
router.get("/", authorizeRoles("admin", "receptionist"), getAllGuests);

router.get(
  "/:id",
  authorizeRoles("admin", "receptionist"),
  validateIdParam("id"),
  getGuestById
);

/**
 * WRITE: admin + receptionist ✅
 * (because the receptionist must be able to register new guests quickly)
 */
router.post("/", authorizeRoles("admin", "receptionist"), createGuest);

router.put(
  "/:id",
  authorizeRoles("admin", "receptionist"),
  validateIdParam("id"),
  updateGuest
);

router.delete(
  "/:id",
  authorizeRoles("admin", "receptionist"),
  validateIdParam("id"),
  deleteGuest
);

export default router;
