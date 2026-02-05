import { Router } from "express";
import {
  getAllBookings,
  getBookingById,
  createBooking,
  updateBooking,
  deleteBooking,
  updateBookingStatus,
} from "../controllers/bookings.controller";

import { authorizeRoles } from "../middlewares/authorizeRoles";
import { validateIdParam } from "../middlewares/validateIdParam";

const router = Router();

/**
 * Bookings
 * - receptionist: read + create + update + update status
 * - admin: everything (including delete)
 */
router.get("/", authorizeRoles("admin", "receptionist"), getAllBookings);

router.get(
  "/:id",
  authorizeRoles("admin", "receptionist"),
  validateIdParam("id"),
  getBookingById
);

router.post("/", authorizeRoles("admin", "receptionist"), createBooking);

router.put(
  "/:id",
  authorizeRoles("admin", "receptionist"),
  validateIdParam("id"),
  updateBooking
);

//  status workflow
router.patch(
  "/:id/status",
  authorizeRoles("admin", "receptionist"),
  validateIdParam("id"),
  updateBookingStatus
);

//  delete admin only
router.delete(
  "/:id",
  authorizeRoles("admin"),
  validateIdParam("id"),
  deleteBooking
);

export default router;
