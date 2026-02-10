import type { Response } from "express";
import prisma from "../services/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import type { AuthRequest } from "../middlewares/authMiddleware";

/**
 * Here I accept optional text fields and convert "" into null,
 * so my database stays consistent (I prefer null over empty strings).
 */
const nullableText = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().nullable().optional()
);

const nullableDate = z.preprocess((v) => {
  if (v == null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? v : d;
}, z.date().nullable().optional());

/**
 * Here I validate guest creation with Zod.
 * I keep name required and allow the rest to be optional (nullable) fields.
 *
 *  I also include nationality because my DB model includes it and my UI uses it.
 */
const guestSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().email("Invalid email").nullable().optional()
  ),
  phone: nullableText,
  documentNumber: nullableText,
  address: nullableText,
  documentType: nullableText,
  nationality: nullableText,
  birthDate: nullableDate,
  gender: nullableText,
  city: nullableText,
  country: nullableText,
});

// Here I reuse the same schema for updates but make everything optional
const updateGuestSchema = guestSchema.partial();

/**
 * Here I build a safe "contains" filter for nullable fields:
 * I ensure the field is not null before applying contains().
 */
const nullableContains = (
  field: "email" | "phone" | "documentNumber" | "address" | "nationality",
  q: string
): Prisma.GuestWhereInput => ({
  AND: [
    { [field]: { not: null } } as unknown as Prisma.GuestWhereInput,
    { [field]: { contains: q, mode: "insensitive" } } as unknown as Prisma.GuestWhereInput,
  ],
});

/* ============================================================
   GET /api/guests (list + search)   MULTI-HOTEL SAFE
   ============================================================ */
export const getAllGuests = async (req: AuthRequest, res: Response) => {
  try {
    // Here I enforce tenant isolation: every query must be scoped by hotelId
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    // Here I optionally apply a search filter across multiple fields
    const searchRaw = req.query.search;

    // Here I start the WHERE already scoped to the current hotel
    const where: Prisma.GuestWhereInput = { hotelId };

    if (typeof searchRaw === "string") {
      const q = searchRaw.trim();
      if (q.length > 0) {
        where.OR = [
          { name: { contains: q, mode: "insensitive" } },
          nullableContains("email", q),
          nullableContains("phone", q),
          nullableContains("documentNumber", q),
          nullableContains("address", q),
          nullableContains("nationality", q),
        ];
      }
    }

    // Here I select explicit fields to keep the response stable
    const guests = await prisma.guest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        documentNumber: true,
        documentType: true,
        address: true,
        nationality: true,
        birthDate: true,
        city: true,
        country: true,
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
   GET /api/guests/:id   MULTI-HOTEL SAFE
   ============================================================ */
export const getGuestById = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid ID" });
    }

    // Here I query with (id + hotelId) to prevent cross-hotel access
    const guest = await prisma.guest.findFirst({
      where: { id, hotelId },
      select: {
       id: true,
        name: true,
        email: true,
        phone: true,
        documentNumber: true,
        documentType: true,
        address: true,
        nationality: true,
        birthDate: true,
        city: true,
        country: true,
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
   POST /api/guests (create)  MULTI-HOTEL SAFE
   ============================================================ */
export const createGuest = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const parsed = guestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid data",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    /**
     * Here I create the guest inside the current hotel.
     * I never trust hotelId coming from the client.
     */
    const newGuest = await prisma.guest.create({
      data: {
        hotelId,
        ...parsed.data,
      },
    });

    return res.status(201).json({ success: true, data: newGuest });
  } catch (error: any) {
    console.error("Error in createGuest:", error);

    // Here I handle unique constraint violations (email unique per hotel)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({
        success: false,
        code: "EMAIL_TAKEN",
        error: "A guest with this email already exists in this hotel.",
      });
    }

    return res.status(500).json({ success: false, error: "Error creating guest" });
  }
};

/* ============================================================
   PUT /api/guests/:id (update)   MULTI-HOTEL SAFE
   ============================================================ */
export const updateGuest = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid ID" });
    }

    const parsed = updateGuestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid data",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    // Here I ensure the guest belongs to my hotel before updating
    const existing = await prisma.guest.findFirst({
      where: { id, hotelId },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "Guest not found" });
    }

    const updated = await prisma.guest.update({
      where: { id },
      data: parsed.data,
    });

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Error in updateGuest:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({
        success: false,
        code: "EMAIL_TAKEN",
        error: "A guest with this email already exists in this hotel.",
      });
    }

    return res.status(500).json({ success: false, error: "Error updating guest" });
  }
};

/* ============================================================
   DELETE /api/guests/:id   MULTI-HOTEL SAFE
   ============================================================ */
export const deleteGuest = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid ID" });
    }

    // Here I ensure the guest belongs to my hotel before deleting
    const existing = await prisma.guest.findFirst({
      where: { id, hotelId },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "Guest not found" });
    }

    await prisma.guest.delete({ where: { id } });

    return res.json({ success: true, message: "Guest deleted successfully" });
  } catch (error: any) {
    console.error("Error in deleteGuest:", error);
    return res.status(500).json({ success: false, error: "Error deleting guest" });
  }
};
