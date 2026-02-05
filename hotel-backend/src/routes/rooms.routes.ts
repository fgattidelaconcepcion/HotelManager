import { Router } from "express";
import {
  getAllRooms,
  createRoom,
  deleteRoom,
  updateRoom,
  getRoomById,
} from "../controllers/rooms.controller";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import { validateIdParam } from "../middlewares/validateIdParam";

const router = Router();

/**
 * Rooms
 * - receptionist: read-only
 * - admin: full CRUD
 */
router.get("/", authorizeRoles("admin", "receptionist"), getAllRooms);

router.get(
  "/:id",
  authorizeRoles("admin", "receptionist"),
  validateIdParam("id"),
  getRoomById
);

// ADMIN only
router.post("/", authorizeRoles("admin"), createRoom);

router.put(
  "/:id",
  authorizeRoles("admin"),
  validateIdParam("id"),
  updateRoom
);

router.delete(
  "/:id",
  authorizeRoles("admin"),
  validateIdParam("id"),
  deleteRoom
);

export default router;
