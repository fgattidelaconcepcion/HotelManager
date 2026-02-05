import { Router } from "express";
import { getRoomTypes, createRoomType } from "../controllers/roomType.controller";
import { authorizeRoles } from "../middlewares/authorizeRoles";

const router = Router();

/**
 * READ: admin + receptionist
 */
router.get("/", authorizeRoles("admin", "receptionist"), getRoomTypes);

/**
 * WRITE: admin only
 * (porque cambia precios base)
 */
router.post("/", authorizeRoles("admin"), createRoomType);

export default router;
