
import { Router } from "express";
import userController from "../controllers/userController";
import { authorizeRoles } from "../middlewares/authorizeRoles";

/**
 * Here I define admin-only routes for employee management.
 * authMiddleware is already applied in the parent router.
 */
const router = Router();

router.get("/", authorizeRoles("admin"), userController.listUsers);
router.post("/", authorizeRoles("admin"), userController.createUser);
router.delete("/:id", authorizeRoles("admin"), userController.deleteUser);

export default router;
