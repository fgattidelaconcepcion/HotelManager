import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getRoomTypes = async (_req: Request, res: Response): Promise<void> => {
  try {
    const types = await prisma.roomType.findMany();
    res.json(types);
  } catch (error) {
    console.error("Error fetching room types:", error);
    res.status(500).json({ error: "Error fetching room types" });
  }
};

export const createRoomType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, basePrice, capacity } = req.body;

    if (!name || !basePrice || !capacity) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const newType = await prisma.roomType.create({
      data: {
        name,
        basePrice: parseFloat(basePrice),
        capacity: parseInt(capacity),
      },
    });

    res.json(newType);
  } catch (error) {
    console.error("Error creating room type:", error);
    res.status(400).json({ error: "Error creating room type" });
  }
};
