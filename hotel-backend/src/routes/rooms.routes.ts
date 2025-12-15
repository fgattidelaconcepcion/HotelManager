import { Router } from "express";
import {
  getAllRooms,
  createRoom,
  deleteRoom,
  updateRoom,
  getRoomById,
} from "../controllers/rooms.controller";

const router = Router();

router.get("/", getAllRooms);
router.get("/:id", getRoomById);
router.post("/", createRoom);
router.put("/:id", updateRoom);
router.delete("/:id", deleteRoom);

export default router;
