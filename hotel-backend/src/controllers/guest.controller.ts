import { Request, Response } from "express";
import prisma from "../services/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";

/**
 * Here I use a helper schema to accept optional text fields and convert "" into null,
 * so my database stays consistent (I prefer null over empty strings).
 */
const nullableText = z.string().optional().or(z.literal("").transform(() => null));

/**
 * Here I validate guest creation with Zod.
 * I keep name required and allow the rest to be optional (nullable) fields.
 */
const guestSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("").transform(() => null)),
  phone: nullableText,
  documentNumber: nullableText,
  address: nullableText,
});

// Here I reuse the same schema for updates but make everything optional
const updateGuestSchema = guestSchema.partial();

/**
 * Here I build a safe "contains" filter for nullable fields:
 * I ensure the field is not null before applying contains() to avoid unexpected issues.
 */
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
   GET /api/guests (list + search)
   ============================================================ */
export const getAllGuests = async (req: Request, res: Response) => {
  try {
    // Here I optionally apply a search filter across multiple fields
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

    /**
     * Here I explicitly select fields to avoid Prisma reading columns that may not exist yet
     * in a production database (this helps prevent P2022 issues).
     */
    const guests = await prisma.guest.findMany({
      where,
      orderBy: { createdAt: "desc" },
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

    return res.status(200).json({ success: true, data: guests });
  } catch (error) {
    console.error("Error in getAllGuests:", error);
    return res.status(500).json({ success: false, error: "Error fetching guests" });
  }
};

/* ============================================================
   GET /api/guests/:id
   ============================================================ */
export const getGuestById = async (req: Request, res: Response) => {
  try {
    // Here I validate and parse the ID param
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid ID" });
    }

    // Here I fetch a guest safely using explicit select
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
      return res.status(404).json({ success: false, error: "Guest not found" });
    }

    return res.json({ success: true, data: guest });
  } catch (error) {
    console.error("Error in getGuestById:", error);
    return res.status(500).json({ success: false, error: "Error fetching guest" });
  }
};

/* ============================================================
   POST /api/guests (create)
   ============================================================ */
export const createGuest = async (req: Request, res: Response) => {
  try {
    // Here I validate input before creating the guest
    const parsed = guestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid data",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    // Here I create the guest with the validated payload
    const newGuest = await prisma.guest.create({ data: parsed.data });

    return res.status(201).json({ success: true, data: newGuest });
  } catch (error: any) {
    console.error("Error in createGuest:", error);

    // Here I handle unique constraint violations (e.g. email already exists)
    if (error?.code === "P2002") {
      return res.status(400).json({
        success: false,
        error: "A guest with this email already exists.",
      });
    }

    return res.status(500).json({ success: false, error: "Error creating guest" });
  }
};

/* ============================================================
   PUT /api/guests/:id (update)
   ============================================================ */
export const updateGuest = async (req: Request, res: Response) => {
  try {
    // Here I validate and parse the ID param
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid ID" });
    }

    // Here I validate the update payload (partial schema)
    const parsed = updateGuestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid data",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    // Here I update the guest with the validated fields only
    const updated = await prisma.guest.update({
      where: { id },
      data: parsed.data,
    });

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Error in updateGuest:", error);

    // Here I handle "not found" updates
    if (error?.code === "P2025") {
      return res.status(404).json({ success: false, error: "Guest not found" });
    }

    // Here I handle unique constraint violations (email already exists)
    if (error?.code === "P2002") {
      return res.status(400).json({
        success: false,
        error: "A guest with this email already exists.",
      });
    }

    return res.status(500).json({ success: false, error: "Error updating guest" });
  }
};

/* ============================================================
   DELETE /api/guests/:id
   ============================================================ */
export const deleteGuest = async (req: Request, res: Response) => {
  try {
    // Here I validate and parse the ID param
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid ID" });
    }

    // Here I delete the guest by ID
    await prisma.guest.delete({ where: { id } });

    return res.json({ success: true, message: "Guest deleted successfully" });
  } catch (error: any) {
    console.error("Error in deleteGuest:", error);

    // Here I handle "not found" deletes
    if (error?.code === "P2025") {
      return res.status(404).json({ success: false, error: "Guest not found" });
    }

    return res.status(500).json({ success: false, error: "Error deleting guest" });
  }
};
