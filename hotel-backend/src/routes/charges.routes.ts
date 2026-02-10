import { Router } from "express";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import { createCharge, deleteCharge, getAllCharges } from "../controllers/charges.controller";

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
 * DELETE: admin only (más seguro)
 */
router.delete("/:id", authorizeRoles("admin"), deleteCharge);

export default router;
