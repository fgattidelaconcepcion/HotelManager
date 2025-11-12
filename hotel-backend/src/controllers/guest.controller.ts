import { Request, Response } from "express";
import prisma from "../services/prisma"; // Asegúrate de que este archivo exporte un PrismaClient

export const getGuests = async (req: Request, res: Response) => {
  try {
    const guests = await prisma.guest.findMany();
    res.json(guests);
  } catch (error) {
    res.status(500).json({ message: "Error fetching guests", error });
  }
};

export const getGuestById = async (req: Request, res: Response) => {
  try {
    const guest = await prisma.guest.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!guest) return res.status(404).json({ message: "Guest not found" });
    res.json(guest);
  } catch (error) {
    res.status(500).json({ message: "Error fetching guest", error });
  }
};

export const createGuest = async (req: Request, res: Response) => {
  try {
    const { name, email, phone } = req.body;
    const newGuest = await prisma.guest.create({
      data: { name, email, phone },
    });
    res.status(201).json(newGuest);
  } catch (error) {
    res.status(500).json({ message: "Error creating guest", error });
  }
};

export const updateGuest = async (req: Request, res: Response) => {
  try {
    const { name, email, phone } = req.body;
    const updatedGuest = await prisma.guest.update({
      where: { id: Number(req.params.id) },
      data: { name, email, phone },
    });
    res.json(updatedGuest);
  } catch (error) {
    res.status(500).json({ message: "Error updating guest", error });
  }
};

export const deleteGuest = async (req: Request, res: Response) => {
  try {
    await prisma.guest.delete({
      where: { id: Number(req.params.id) },
    });
    res.json({ message: "Guest deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting guest", error });
  }
};
