import { Router } from "express";
import {
  getAllPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  deletePayment,
} from "../controllers/payments.controller";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import { validateIdParam } from "../middlewares/validateIdParam";

const router = Router();

/**
 * Payments
 * - receptionist: view/create/update
 * - admin: everything (including delete)
 */
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
