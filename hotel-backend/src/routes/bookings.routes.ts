import { Router } from "express";
import {
  getAllBookings,
  createBooking,
  updateBooking,
  deleteBooking,
} from "../controllers/bookings.controller";

const router = Router();

router.get("/", getAllBookings);
router.post("/", createBooking);
router.put("/:id", updateBooking);
router.delete("/:id", deleteBooking);

export default router;
