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

/**  Obtener habitaciones disponibles en un rango de fechas */
export const getAvailableRooms = async (req: Request, res: Response) => {
  try {
    const { checkIn, checkOut } = req.query;

    if (!checkIn || !checkOut) {
      return res.status(400).json({ error: "Faltan parámetros de fecha" });
    }

    const checkInDate = new Date(checkIn as string);
    const checkOutDate = new Date(checkOut as string);

    // Buscar habitaciones que NO tengan reservas que se crucen
    const availableRooms = await prisma.room.findMany({
      where: {
        // Solo habitaciones que no tengan reservas solapadas
        bookings: {
          none: {
            AND: [
              {
                checkOut: { lte: checkInDate },
                checkIn: { gte: checkOutDate },
              },
            ],
          },
        },
      },
      include: { roomType: true },
      orderBy: { number: "asc" },
    });

    res.json(availableRooms);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener habitaciones disponibles" });
  }
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
