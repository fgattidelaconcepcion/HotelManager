import { Router } from "express";
import userController from "../controllers/userController";

const router = Router();

// Rutas de usuario
router.post("/register", userController.register);
router.post("/login", userController.login);

export default router;
