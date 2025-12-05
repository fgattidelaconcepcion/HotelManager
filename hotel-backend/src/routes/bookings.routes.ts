import { Router } from "express";
import {
  getAllBookings,
  createBooking,
  updateBooking,
  deleteBooking,
  getBookingById,
  updateBookingStatus,
} from "../controllers/bookings.controller";

const router = Router();

/*  
     RUTAS DE RESERVAS
     (en desarrollo SIN auth; después podemos volver a protegerlas)
*/

// Obtener todas las reservas
router.get("/", getAllBookings);

// Obtener una reserva por ID
router.get("/:id", getBookingById);

// Crear reserva
router.post("/", createBooking);

// Actualizar fechas de la reserva
router.put("/:id", updateBooking);

// Actualizar estado de reserva (pending → confirmed → cancelled)
router.patch("/:id/status", updateBookingStatus);

// Eliminar reserva
router.delete("/:id", deleteBooking);

export default router;
