import type { Response } from "express";
import prisma from "../services/prisma";
import type { AuthRequest } from "../middlewares/authMiddleware";

/**
 * Here I expose the current tenant (hotel) settings for the logged-in user.
 * This is useful for:
 * - Admin settings page
 * - Printing/exporting RIHP/Police reports with correct hotel metadata
 */

/**
 * GET /api/hotel/me
 * Roles: admin + receptionist (read-only)
 */
export const getMyHotel = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const hotel = await prisma.hotel.findUnique({
      where: { id: hotelId },
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        responsibleName: true,
        registrationNumber: true,
        createdAt: true,
      },
    });

    if (!hotel) {
      return res.status(404).json({ success: false, error: "Hotel not found" });
    }

    return res.status(200).json({ success: true, data: hotel });
  } catch (error) {
    console.error("Error in getMyHotel:", error);
    return res.status(500).json({ success: false, error: "Error loading hotel settings" });
  }
};

/**
 * PUT /api/hotel/me
 * Roles: admin only (write)
 *
 * Body (all optional):
 * - address
 * - responsibleName
 * - registrationNumber
 *
 * Note:
 * - I keep it minimal: only update the fields we introduced.
 * - I trim strings and allow clearing by sending empty string -> null.
 */
export const updateMyHotel = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    if (!hotelId) {
      return res.status(401).json({ success: false, error: "Missing hotel context" });
    }

    const toOptionalStringOrNull = (v: any) => {
      if (v == null) return undefined; // not provided -> do not update
      const s = String(v).trim();
      return s ? s : null; // provided but empty -> clear
    };

    const data: any = {};

    const address = toOptionalStringOrNull(req.body?.address);
    const responsibleName = toOptionalStringOrNull(req.body?.responsibleName);
    const registrationNumber = toOptionalStringOrNull(req.body?.registrationNumber);

    if (address !== undefined) data.address = address;
    if (responsibleName !== undefined) data.responsibleName = responsibleName;
    if (registrationNumber !== undefined) data.registrationNumber = registrationNumber;

    // If nothing was sent, I return the current hotel settings.
    if (Object.keys(data).length === 0) {
      const hotel = await prisma.hotel.findUnique({
        where: { id: hotelId },
        select: {
          id: true,
          name: true,
          code: true,
          address: true,
          responsibleName: true,
          registrationNumber: true,
          createdAt: true,
        },
      });
      return res.status(200).json({ success: true, data: hotel });
    }

    const updated = await prisma.hotel.update({
      where: { id: hotelId },
      data,
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        responsibleName: true,
        registrationNumber: true,
        createdAt: true,
      },
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Error in updateMyHotel:", error);
    return res.status(500).json({ success: false, error: "Error updating hotel settings" });
  }
};
