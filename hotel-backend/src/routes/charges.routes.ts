import { Router } from "express";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import {
  createCharge,
  deleteCharge,
  getAllCharges,
  updateCharge,
} from "../controllers/charges.controller";

const router = Router();

/**
 * READ: admin + receptionist
 */
router.get("/", authorizeRoles("admin", "receptionist"), getAllCharges);

/**
 * WRITE: admin + receptionist (porque recepción suele cargar consumos)
 */
router.post("/", authorizeRoles("admin", "receptionist"), createCharge);

/**
 * UPDATE: admin + receptionist
 * (si querés más estricto: dejalo solo para admin)
 */
router.put("/:id", authorizeRoles("admin", "receptionist"), updateCharge);

/**
 * DELETE: admin only (más seguro)
 */
router.delete("/:id", authorizeRoles("admin"), deleteCharge);

export default router;
