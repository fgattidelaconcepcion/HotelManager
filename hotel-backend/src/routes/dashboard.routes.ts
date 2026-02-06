import { Router } from "express";
import { getDashboard } from "../controllers/dashboard.controller";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

/**
 * Here I require authentication so req.user exists (hotelId comes from the JWT).
 */
router.get("/", authMiddleware, getDashboard);

export default router;
