import { Router } from "express";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import {
  previewDailyClose,
  createDailyClose,
  listDailyCloses,
  getDailyCloseById,
} from "../controllers/dailyClose.controller";

const router = Router();

/**
 * Daily Close (Option A)
 *
 * Goal:
 * - Allow both admin and receptionist to create the daily close
 * - Keep backend as the source of truth (role checks happen here)
 *
 * Mounted at: /api/daily-close
 */

// Preview the numbers before closing (admin + receptionist)
router.get("/preview", authorizeRoles("admin", "receptionist"), previewDailyClose);

// List previous closes (admin + receptionist)
router.get("/", authorizeRoles("admin", "receptionist"), listDailyCloses);

// Create the close (admin + receptionist)
router.post("/", authorizeRoles("admin", "receptionist"), createDailyClose);

// Read one close (admin + receptionist) - optional but useful for UI
router.get("/:id", authorizeRoles("admin", "receptionist"), getDailyCloseById);

export default router;
