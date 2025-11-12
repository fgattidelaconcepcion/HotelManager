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

    const availableRooms = await prisma.room.findMany({
      where: {
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
    console.log(" Datos recibidos en /api/rooms:", req.body); 

    const { number, roomTypeId, status, description } = req.body;

    if (!number || !roomTypeId) {
      return res.status(400).json({ error: "Número y tipo son requeridos" });
    }

    const room = await prisma.room.create({
      data: {
        number,
        roomTypeId: parseInt(roomTypeId),
        status: status || "disponible",
        description,
      },
    });

    res.json(room);
  } catch (err) {
    console.error(" Error creando habitación:", err);
    res.status(400).json({ error: "Error creando habitación" });
  }
};
