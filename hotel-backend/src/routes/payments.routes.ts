import { Router } from "express";
import {
  getAllPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  deletePayment,
} from "../controllers/payments.controller";

const router = Router();

// Lista de pagos (opcionalmente filtrados por bookingId o status)
router.get("/", getAllPayments);

// Un pago por ID
router.get("/:id", getPaymentById);

// Crear pago
router.post("/", createPayment);

// Actualizar pago
router.put("/:id", updatePayment);

// Eliminar pago
router.delete("/:id", deletePayment);

export default router;
