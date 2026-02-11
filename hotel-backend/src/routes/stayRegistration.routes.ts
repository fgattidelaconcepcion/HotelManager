import { Router } from "express";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import {
  createStayRegistrationForBooking,
  exportStayRegistrationPdfByBooking,
} from "../controllers/stayRegistration.controller";

const router = Router();

/**
 * STAY REGISTRATION (Police snapshot per booking)
 *
 * Notes:
 * - Tenant isolation is enforced inside the controller with req.user.hotelId.
 * - Roles:
 *   - create snapshot: admin + receptionist
 *   - export single booking PDF: admin + receptionist
 */

/**
 * POST /api/bookings/:id/stay-registration
 * Here I create a stay registration snapshot for one booking.
 */
router.post(
  "/bookings/:id/stay-registration",
  authorizeRoles("admin", "receptionist"),
  createStayRegistrationForBooking
);

/**
 * GET /api/bookings/:id/stay-registration/pdf
 * Here I export a printable PDF for ONE booking stay registration.
 */
router.get(
  "/bookings/:id/stay-registration/pdf",
  authorizeRoles("admin", "receptionist"),
  exportStayRegistrationPdfByBooking
);

export default router;
