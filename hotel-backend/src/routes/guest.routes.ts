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
 * WRITE: admin only
 */
router.post("/", authorizeRoles("admin"), createGuest);

router.put(
  "/:id",
  authorizeRoles("admin"),
  validateIdParam("id"),
  updateGuest
);

router.delete(
  "/:id",
  authorizeRoles("admin"),
  validateIdParam("id"),
  deleteGuest
);

export default router;
