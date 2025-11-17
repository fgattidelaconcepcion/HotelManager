import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getAllRooms = async (_: Request, res: Response) => {
  try {
    const rooms = await prisma.room.findMany({
      include: { roomType: true },
      orderBy: { number: "asc" },
    });
    res.json(rooms);
  } catch (err) {
    console.error("Error obteniendo habitaciones:", err);
    res.status(500).json({ error: "Error al obtener habitaciones" });
  }
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
              { checkIn: { lt: checkOutDate } },  
              { checkOut: { gt: checkInDate } }    
            ]
          }
        }
      },
      include: { roomType: true },
      orderBy: { number: "asc" },
    });

    res.json(availableRooms);
  } catch (error) {
    console.error("Error obteniendo habitaciones disponibles:", error);
    res.status(500).json({ error: "Error al obtener habitaciones disponibles" });
  }
};

export const createRoom = async (req: Request, res: Response) => {
  try {
    console.log("Datos recibidos en /api/rooms:", req.body);

    // Extraer valores tal como vienen desde el front
    const { number, floor, roomTypeId, status, description } = req.body;

    // Validaciones básicas
    if (!number) {
      return res.status(400).json({ error: "Número es requerido" });
    }

    // floor puede venir como string o number — convertir y validar
    const parsedFloor = typeof floor === "number" ? floor : parseInt(floor);
    if (Number.isNaN(parsedFloor)) {
      return res.status(400).json({ error: "Piso inválido" });
    }

    // roomTypeId puede venir como string o number — convertir y validar
    const parsedRoomTypeId =
      typeof roomTypeId === "number" ? roomTypeId : parseInt(roomTypeId);
    if (Number.isNaN(parsedRoomTypeId)) {
      return res
        .status(400)
        .json({ error: "Tipo de habitación inválido o no seleccionado" });
    }

    // Crear habitación
    const room = await prisma.room.create({
      data: {
        number,
        floor: parsedFloor,
        roomTypeId: parsedRoomTypeId,
        status: status || "disponible",
        description,
      },
    });

    res.status(201).json(room);
  } catch (err) {
    console.error("Error creando habitación:", err);
    // Distingo errores del DB y devuelvo 500
    res.status(500).json({ error: "Error creando habitación" });
  }
};

export const deleteRoom = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const roomId = parseInt(id);
    if (isNaN(roomId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    await prisma.room.delete({
      where: { id: roomId },
    });

    res.json({ message: "Habitación eliminada correctamente" });
  } catch (e: any) {
    console.error("Error eliminando habitación:", e);

    if (e.code === "P2025") {
      return res.status(404).json({ error: "Habitación no encontrada" });
    }

    res.status(500).json({ error: "Error al eliminar habitación" });
  }
};
 export const updateRoom = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const roomId = parseInt(id);
    if (isNaN(roomId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const { number, floor, roomTypeId, status, description } = req.body;

    const updated = await prisma.room.update({
      where: { id: roomId },
      data: {
        number,
        floor,
        roomTypeId,
        status,
        description,
      },
    });

    res.json(updated);
  } catch (e: any) {
    console.error("Error actualizando habitación:", e);

    if (e.code === "P2025") {
      return res.status(404).json({ error: "Habitación no encontrada" });
    }

    res.status(500).json({ error: "Error al actualizar habitación" });
  }
};

