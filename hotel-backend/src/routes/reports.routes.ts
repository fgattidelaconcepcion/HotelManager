import { Router } from "express";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import {
  exportPoliceReportCsv,
  exportPoliceReportPdf,
} from "../controllers/stayRegistration.controller";

const router = Router();

/**
 * RIHP / Police exports (Uruguay)
 * NOTE: These routes are protected by authMiddleware at routes/index.ts
 *
 * GET /api/reports/police?from=YYYY-MM-DD&to=YYYY-MM-DD        => CSV
 * GET /api/reports/police/pdf?from=YYYY-MM-DD&to=YYYY-MM-DD    => PDF
 *
 * Roles: admin only (as requested)
 */
router.get("/police", authorizeRoles("admin"), exportPoliceReportCsv);
router.get("/police/pdf", authorizeRoles("admin"), exportPoliceReportPdf);

export default router;
