import { Router } from "express";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import {
  createStayRegistrationForBooking,
  exportPoliceReportCsv,
  exportPoliceReportPdf,
  exportStayRegistrationPdfByBooking,
} from "../controllers/stayRegistration.controller";

const router = Router();

/**
 * STAY REGISTRATION (Police report snapshot)
 *
 * Notes:
 * - Tenant isolation is enforced inside the controller with req.user.hotelId.
 * - Roles:
 *   - create snapshot: admin + receptionist
 *   - export reports (CSV/PDF): admin only
 */

/**
 * Here I create a stay registration snapshot for a booking.
 * admin + receptionist
 *
 * POST /api/bookings/:id/stay-registration
 */
router.post(
  "/bookings/:id/stay-registration",
  authorizeRoles("admin", "receptionist"),
  createStayRegistrationForBooking // 
);

/**
 * Here I export a CSV police report (multiple rows).
 * admin only
 *
 * GET /api/reports/police?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
router.get(
  "/reports/police",
  authorizeRoles("admin"),
  exportPoliceReportCsv 
);

/**
 * Here I export a PRINTABLE PDF police report (multiple rows).
 * admin only
 *
 * GET /api/reports/police/pdf?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
router.get(
  "/reports/police/pdf",
  authorizeRoles("admin"),
  exportPoliceReportPdf 
);

/**
 * Here I export a PDF for ONE booking stay registration.
 * admin + receptionist
 *
 * GET /api/bookings/:id/stay-registration/pdf
 */
router.get(
  "/bookings/:id/stay-registration/pdf",
  authorizeRoles("admin", "receptionist"),
  exportStayRegistrationPdfByBooking // 
);

export default router;
