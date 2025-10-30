import { Router } from "express";
import { getAllRooms, createRoom } from "../controllers/rooms.controller";

const router = Router();
router.get("/", getAllRooms);
router.post("/", createRoom);

export default router;
