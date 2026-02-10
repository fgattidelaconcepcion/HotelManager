import { Router } from "express";
import { getPlanning } from "../controllers/planning.controller";
import { authorizeRoles } from "../middlewares/authorizeRoles";

const router = Router();

/**
 * Planning
 * - receptionist/admin can view planning
 */
router.get("/", authorizeRoles("admin", "receptionist"), getPlanning);

export default router;
