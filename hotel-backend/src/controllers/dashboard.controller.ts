import { Request, Response } from "express";
import prisma from "../services/prisma";

function startOfLocalDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfLocalDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export const getDashboard = async (_req: Request, res: Response) => {
  try {
    const todayStart = startOfLocalDay(new Date());
    const todayEnd = endOfLocalDay(new Date());

    const [totalRooms, activeBookingsCount, completedPaymentsAgg, todaysCheckIns, todaysCheckOuts] =
      await Promise.all([
        prisma.room.count(),
        prisma.booking.count({
          where: { status: { in: ["confirmed", "checked_in"] } },
        }),
        prisma.payment.aggregate({
          where: { status: "completed" },
          _sum: { amount: true },
        }),
        prisma.booking.count({
          where: {
            status: { in: ["confirmed", "checked_in", "checked_out"] },
            checkIn: { gte: todayStart, lte: todayEnd },
          },
        }),
        prisma.booking.count({
          where: {
            status: { in: ["confirmed", "checked_in", "checked_out"] },
            checkOut: { gte: todayStart, lte: todayEnd },
          },
        }),
      ]);

    const totalRevenue = completedPaymentsAgg._sum.amount ?? 0;
    const occupancyRate =
      totalRooms > 0 ? Math.round((activeBookingsCount / totalRooms) * 100) : 0;

    const [latestBookings, latestPayments] = await Promise.all([
      prisma.booking.findMany({
        orderBy: { checkIn: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          checkIn: true,
          checkOut: true,
          totalPrice: true,
          room: { select: { id: true, number: true, floor: true } },
          guest: { select: { id: true, name: true, email: true, phone: true } }, // select seguro
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
      prisma.payment.findMany({
        where: { status: "completed" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          amount: true,
          status: true,
          createdAt: true,
          bookingId: true,
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalRooms,
        occupancyRate,
        activeBookingsCount,
        totalRevenue,
        todaysCheckIns,
        todaysCheckOuts,
        latestBookings,
        latestPayments,
        serverNow: new Date().toISOString(),
        tz: process.env.TZ ?? null,
      },
    });
  } catch (error) {
    console.error("Error en getDashboard:", error);
    return res.status(500).json({
      success: false,
      error: "Error al obtener dashboard",
    });
  }
};
