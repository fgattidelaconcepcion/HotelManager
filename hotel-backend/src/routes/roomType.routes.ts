import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

// Obtener todos los tipos
router.get("/", async (_, res) => {
  const types = await prisma.roomType.findMany();
  res.json(types);
});

// Crear un nuevo tipo
router.post("/", async (req, res) => {
  try {
    const { name, basePrice, capacity } = req.body;
    const roomType = await prisma.roomType.create({
      data: { name, basePrice, capacity },
    });
    res.json(roomType);
  } catch (err) {
    console.error("Error creating room type:", err);
    res.status(400).json({ error: "Error creating room type" });
  }
});

export default router;
