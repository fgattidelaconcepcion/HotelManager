import { Router } from "express";
import {
  getAllRooms,
  createRoom,
  deleteRoom,
  updateRoom,
  getRoomById,
} from "../controllers/rooms.controller";

const router = Router();

// Obtener todas las habitaciones
router.get("/", getAllRooms);

// Obtener habitación por ID
router.get("/:id", getRoomById);

// Crear nueva habitación
router.post("/", createRoom);

// Actualizar habitación
router.put("/:id", updateRoom);

// Eliminar habitación
router.delete("/:id", deleteRoom);

export default router;
