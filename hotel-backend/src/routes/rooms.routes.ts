import { Router } from "express";
import {
  getAllRooms,
  createRoom,
  getAvailableRooms,
  deleteRoom,
  updateRoom,
  getRoomById,
} from "../controllers/rooms.controller";

const router = Router();

// Obtener habitaciones disponibles
router.get("/available", getAvailableRooms);

router.get("/:id", getRoomById);

// Obtener todas
router.get("/", getAllRooms);

// Crear nueva habitación
router.post("/", createRoom);

// Actualizar habitación
router.put("/:id", updateRoom);

// Eliminar habitación
router.delete("/:id", deleteRoom);

export default router;
