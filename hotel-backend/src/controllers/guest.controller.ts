import { Request, Response } from "express";
import prisma from "../services/prisma";
import { z } from "zod";

/* VALIDACIÓN */
const guestSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().email("Email inválido").optional().nullable(),
  phone: z.string().min(6, "Teléfono inválido").optional().nullable(),
});

const updateGuestSchema = guestSchema.partial();

/* Limpiar undefined (Prisma no lo acepta) */
function cleanObject(obj: any) {
  const cleaned: any = {};
  for (const key in obj) {
    if (obj[key] !== undefined) cleaned[key] = obj[key];
  }
  return cleaned;
}

/* CONTROLADORES */

// Obtener todos los huéspedes
export const getGuests = async (_req: Request, res: Response) => {
  try {
    const guests = await prisma.guest.findMany({
      orderBy: { id: "asc" },
    });
    return res.status(200).json({ success: true, guests });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Error al obtener huéspedes",
    });
  }
};

// Obtener huésped por ID
export const getGuestById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id))
      return res.status(400).json({ success: false, error: "ID inválido" });

    const guest = await prisma.guest.findUnique({ where: { id } });
    if (!guest)
      return res
        .status(404)
        .json({ success: false, error: "Huésped no encontrado" });

    return res.status(200).json({ success: true, guest });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Error al obtener huésped",
    });
  }
};

// Crear huésped
export const createGuest = async (req: Request, res: Response) => {
  try {
    const parsed = guestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Datos inválidos",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const cleanedData = cleanObject(parsed.data);

    const newGuest = await prisma.guest.create({
      data: cleanedData,
    });

    return res.status(201).json({
      success: true,
      message: "Huésped creado correctamente",
      guest: newGuest,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Error al crear huésped",
    });
  }
};

// Actualizar huésped
export const updateGuest = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id))
      return res.status(400).json({ success: false, error: "ID inválido" });

    const parsed = updateGuestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Datos inválidos",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const cleanedData = cleanObject(parsed.data);

    const updatedGuest = await prisma.guest.update({
      where: { id },
      data: cleanedData,
    });

    return res.status(200).json({
      success: true,
      message: "Huésped actualizado correctamente",
      guest: updatedGuest,
    });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, error: "Huésped no encontrado" });
    }
    return res.status(500).json({
      success: false,
      error: "Error al actualizar huésped",
    });
  }
};

// Eliminar huésped
export const deleteGuest = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id))
      return res.status(400).json({ success: false, error: "ID inválido" });

    await prisma.guest.delete({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Huésped eliminado correctamente",
    });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, error: "Huésped no encontrado" });
    }

    return res.status(500).json({
      success: false,
      error: "Error al eliminar huésped",
    });
  }
};
