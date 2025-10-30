import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getAllRooms = async (_: Request, res: Response) => {
  const rooms = await prisma.room.findMany({
    include: { roomType: true },
    orderBy: { number: "asc" },
  });
  res.json(rooms);
};

export const createRoom = async (req: Request, res: Response) => {
  try {
    const { number, floor, roomTypeId, description } = req.body;
    const room = await prisma.room.create({
      data: { number, floor, roomTypeId, description },
    });
    res.json(room);
  } catch (err) {
    res.status(400).json({ error: "Error creating room" });
  }
};
