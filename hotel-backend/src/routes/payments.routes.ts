import { Router } from "express";
import {
  getAllPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  deletePayment,
  getBookingPaymentSummary,
} from "../controllers/payments.controller";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import { validateIdParam } from "../middlewares/validateIdParam";

const router = Router();

/**
 * Payments
 * - receptionist: view/create/update
 * - admin: everything (including delete)
 */

/**
 * Here I expose a financial summary endpoint for one reservation.
 * This is what the frontend uses to compute Due including charges.
 */
router.get(
  "/booking/:bookingId/summary",
  authorizeRoles("admin", "receptionist"),
  validateIdParam("bookingId"),
  getBookingPaymentSummary
);

router.get("/", authorizeRoles("admin", "receptionist"), getAllPayments);

router.get(
  "/:id",
  authorizeRoles("admin", "receptionist"),
  validateIdParam("id"),
  getPaymentById
);

router.post("/", authorizeRoles("admin", "receptionist"), createPayment);

router.put(
  "/:id",
  authorizeRoles("admin", "receptionist"),
  validateIdParam("id"),
  updatePayment
);

router.delete(
  "/:id",
  authorizeRoles("admin"),
  validateIdParam("id"),
  deletePayment
);

export default router;
