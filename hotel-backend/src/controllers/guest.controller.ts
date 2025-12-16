import { Request, Response } from "express";
import prisma from "../services/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";

// Helper: string opcional que convierte "" -> null
const nullableText = z.string().optional().or(z.literal("").transform(() => null));

// Validación con Zod
const guestSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  email: z.string().email("Email inválido").optional().or(z.literal("").transform(() => null)),
  phone: nullableText,
  documentNumber: nullableText,
  address: nullableText,
});

const updateGuestSchema = guestSchema.partial();

// Helper para búsqueda en campos nullable: AND [not null, contains]
const nullableContains = (
  field: "email" | "phone" | "documentNumber" | "address",
  q: string
): Prisma.GuestWhereInput => ({
  AND: [
    { [field]: { not: null } } as unknown as Prisma.GuestWhereInput,
    { [field]: { contains: q, mode: "insensitive" } } as unknown as Prisma.GuestWhereInput,
  ],
});

/* ============================================================
      GET /api/guests   (lista + búsqueda)
   ============================================================ */
export const getAllGuests = async (req: Request, res: Response) => {
  try {
    const searchRaw = req.query.search;
    const where: Prisma.GuestWhereInput = {};

    if (typeof searchRaw === "string") {
      const q = searchRaw.trim();
      if (q.length > 0) {
        where.OR = [
          { name: { contains: q, mode: "insensitive" } },
          nullableContains("email", q),
          nullableContains("phone", q),
          nullableContains("documentNumber", q),
          nullableContains("address", q),
        ];
      }
    }

    // ✅ Importante: selecciono campos explícitos.
    // Esto evita que Prisma intente leer columnas que quizá no existen aún en la DB prod.
    const guests = await prisma.guest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        // Si tu DB ya tiene estas columnas, las devolvemos.
        // Si NO las tiene todavía y te sigue tirando P2022, comentá estas 2 líneas temporalmente
        // y aplicá la migración/alter en la DB.
        documentNumber: true,
        address: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({ success: true, data: guests });
  } catch (error) {
    console.error("Error en getAllGuests:", error);
    return res.status(500).json({ success: false, error: "Error al obtener huéspedes" });
  }
};

/* ============================================================
      GET /api/guests/:id
   ============================================================ */
export const getGuestById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, error: "ID inválido" });
    }

    const guest = await prisma.guest.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        documentNumber: true,
        address: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!guest) {
      return res.status(404).json({ success: false, error: "Huésped no encontrado" });
    }

    return res.json({ success: true, data: guest });
  } catch (error) {
    console.error("Error en getGuestById:", error);
    return res.status(500).json({ success: false, error: "Error al obtener huésped" });
  }
};

/* ============================================================
      POST /api/guests (Crear)
   ============================================================ */
export const createGuest = async (req: Request, res: Response) => {
  try {
    const parsed = guestSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Datos inválidos",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const newGuest = await prisma.guest.create({ data: parsed.data });

    return res.status(201).json({ success: true, data: newGuest });
  } catch (error: any) {
    console.error("Error en createGuest:", error);

    if (error?.code === "P2002") {
      return res.status(400).json({
        success: false,
        error: "Ya existe un huésped con ese email.",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Error al crear huésped",
    });
  }
};

/* ============================================================
      PUT /api/guests/:id   (Actualizar)
   ============================================================ */
export const updateGuest = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, error: "ID inválido" });
    }

    const parsed = updateGuestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Datos inválidos",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const updated = await prisma.guest.update({
      where: { id },
      data: parsed.data,
    });

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Error en updateGuest:", error);

    if (error?.code === "P2025") {
      return res.status(404).json({ success: false, error: "Huésped no encontrado" });
    }

    if (error?.code === "P2002") {
      return res.status(400).json({
        success: false,
        error: "Ya existe un huésped con ese email.",
      });
    }

    return res.status(500).json({ success: false, error: "Error al actualizar huésped" });
  }
};

/* ============================================================
      DELETE /api/guests/:id
   ============================================================ */
export const deleteGuest = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, error: "ID inválido" });
    }

    await prisma.guest.delete({ where: { id } });

    return res.json({ success: true, message: "Huésped eliminado correctamente" });
  } catch (error: any) {
    console.error("Error en deleteGuest:", error);

    if (error?.code === "P2025") {
      return res.status(404).json({ success: false, error: "Huésped no encontrado" });
    }

    return res.status(500).json({ success: false, error: "Error al eliminar huésped" });
  }
};
