import { Router } from "express";
import {
  getRoomTypes,
  createRoomType,
  updateRoomType,
  deleteRoomType,
} from "../controllers/roomType.controller";
import { authorizeRoles } from "../middlewares/authorizeRoles";

const router = Router();

/**
 * READ: admin + receptionist
 */
router.get("/", authorizeRoles("admin", "receptionist"), getRoomTypes);

/**
 * WRITE: admin only
 */
router.post("/", authorizeRoles("admin"), createRoomType);

/**
 * OPTIONAL CRUD: admin only
 */
router.put("/:id", authorizeRoles("admin"), updateRoomType);
router.delete("/:id", authorizeRoles("admin"), deleteRoomType);

export default router;
