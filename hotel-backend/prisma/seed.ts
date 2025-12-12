import prisma from "../src/services/prisma";
import { hashPassword } from "../src/utils/hash";

async function main() {
  console.log("🌱 Seeding database...");

  /* =========================
     USERS
  ========================= */

  const adminPassword = await hashPassword("123456");
  const receptionistPassword = await hashPassword("123456");

  const admin = await prisma.user.upsert({
    where: { email: "admin@hotel.com" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@hotel.com",
      password: adminPassword,
      role: "admin",
    },
  });

  const receptionist = await prisma.user.upsert({
    where: { email: "reception@hotel.com" },
    update: {},
    create: {
      name: "Reception User",
      email: "reception@hotel.com",
      password: receptionistPassword,
      role: "receptionist",
    },
  });

  /* =========================
     ROOM TYPES
  ========================= */

  const single = await prisma.roomType.upsert({
    where: { name: "Single" },
    update: {},
    create: { name: "Single", basePrice: 80, capacity: 1 },
  });

  const double = await prisma.roomType.upsert({
    where: { name: "Double" },
    update: {},
    create: { name: "Double", basePrice: 120, capacity: 2 },
  });

  const suite = await prisma.roomType.upsert({
    where: { name: "Suite" },
    update: {},
    create: { name: "Suite", basePrice: 200, capacity: 4 },
  });

  /* =========================
     ROOMS
  ========================= */

  const room101 = await prisma.room.upsert({
    where: { number: "101" },
    update: {},
    create: {
      number: "101",
      floor: 1,
      description: "Single room with city view",
      roomTypeId: single.id,
    },
  });

  const room202 = await prisma.room.upsert({
    where: { number: "202" },
    update: {},
    create: {
      number: "202",
      floor: 2,
      description: "Double room with balcony",
      roomTypeId: double.id,
    },
  });

  const room301 = await prisma.room.upsert({
    where: { number: "301" },
    update: {},
    create: {
      number: "301",
      floor: 3,
      description: "Luxury suite",
      roomTypeId: suite.id,
    },
  });

  /* =========================
     GUESTS
  ========================= */

  const guest1 = await prisma.guest.upsert({
    where: { email: "john@example.com" },
    update: {},
    create: {
      name: "John Doe",
      email: "john@example.com",
      phone: "+598123456",
    },
  });

  const guest2 = await prisma.guest.upsert({
    where: { email: "jane@example.com" },
    update: {},
    create: {
      name: "Jane Smith",
      email: "jane@example.com",
      phone: "+598987654",
    },
  });

  /* =========================
     BOOKINGS
  ========================= */

  const booking1 = await prisma.booking.create({
    data: {
      roomId: room101.id,
      guestId: guest1.id,
      userId: receptionist.id,
      checkIn: new Date("2025-12-15"),
      checkOut: new Date("2025-12-18"),
      totalPrice: 240,
      status: "confirmed",
    },
  });

  const booking2 = await prisma.booking.create({
    data: {
      roomId: room301.id,
      guestId: guest2.id,
      userId: admin.id,
      checkIn: new Date("2025-12-20"),
      checkOut: new Date("2025-12-25"),
      totalPrice: 1000,
      status: "pending",
    },
  });

  /* =========================
     PAYMENTS
  ========================= */

  await prisma.payment.create({
    data: {
      bookingId: booking1.id,
      amount: 240,
      method: "card",
      status: "completed",
    },
  });

  console.log("✅ Seed completed successfully");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
