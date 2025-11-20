import { Router } from "express";
import {
  getAllBookings,
  createBooking,
  updateBooking,
  deleteBooking,
  getBookingById,
  updateBookingStatus,
} from "../controllers/bookings.controller";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

/*  
     RUTAS PROTEGIDAS
     (todas las reservas requieren autenticación)
*/
router.use(authMiddleware);

/*  
     RUTAS PRINCIPALES
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
