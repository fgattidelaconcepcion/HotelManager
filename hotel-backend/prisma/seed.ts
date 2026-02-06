import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/utils/hash";

/**
 * Here I use a dedicated PrismaClient instance for seeding.
 * I keep it isolated from my app runtime client to avoid side effects.
 */
const prisma = new PrismaClient();

async function main() {
  /**
   * =========================================================
   * 1) CREATE (OR REUSE) A DEMO HOTEL TENANT
   * =========================================================
   * Here I create a single demo hotel that will own all seed data.
   * Because hotel.code is unique globally, I can safely upsert by code.
   */
  const hotel = await prisma.hotel.upsert({
    where: { code: "demo-hotel" },
    update: { name: "Demo Hotel" },
    create: {
      name: "Demo Hotel",
      code: "demo-hotel",
    },
  });

  /**
   * =========================================================
   * 2) USERS (ADMIN + RECEPTIONIST) - UNIQUE PER HOTEL
   * =========================================================
   * Here I must use the compound unique constraint: (hotelId, email)
   */
  const adminPassword = await hashPassword("admin123");
  const recepPassword = await hashPassword("recep123");

  const admin = await prisma.user.upsert({
    where: {
      hotelId_email: {
        hotelId: hotel.id,
        email: "admin@hotel.com",
      },
    },
    update: {
      name: "Admin",
      role: "admin",
      password: adminPassword,
    },
    create: {
      hotelId: hotel.id,
      name: "Admin",
      email: "admin@hotel.com",
      password: adminPassword,
      role: "admin",
    },
    select: { id: true, hotelId: true, email: true, role: true, name: true },
  });

  const receptionist = await prisma.user.upsert({
    where: {
      hotelId_email: {
        hotelId: hotel.id,
        email: "reception@hotel.com",
      },
    },
    update: {
      name: "Receptionist",
      role: "receptionist",
      password: recepPassword,
    },
    create: {
      hotelId: hotel.id,
      name: "Receptionist",
      email: "reception@hotel.com",
      password: recepPassword,
      role: "receptionist",
    },
    select: { id: true, hotelId: true, email: true, role: true, name: true },
  });

  /**
   * =========================================================
   * 3) ROOM TYPES - UNIQUE PER HOTEL
   * =========================================================
   * Here I must use compound unique: (hotelId, name)
   */
  const single = await prisma.roomType.upsert({
    where: {
      hotelId_name: { hotelId: hotel.id, name: "Single" },
    },
    update: {
      basePrice: 80,
      capacity: 1,
    },
    create: {
      hotelId: hotel.id,
      name: "Single",
      basePrice: 80,
      capacity: 1,
    },
  });

  const double = await prisma.roomType.upsert({
    where: {
      hotelId_name: { hotelId: hotel.id, name: "Double" },
    },
    update: {
      basePrice: 120,
      capacity: 2,
    },
    create: {
      hotelId: hotel.id,
      name: "Double",
      basePrice: 120,
      capacity: 2,
    },
  });

  const suite = await prisma.roomType.upsert({
    where: {
      hotelId_name: { hotelId: hotel.id, name: "Suite" },
    },
    update: {
      basePrice: 200,
      capacity: 4,
    },
    create: {
      hotelId: hotel.id,
      name: "Suite",
      basePrice: 200,
      capacity: 4,
    },
  });

  /**
   * =========================================================
   * 4) ROOMS - UNIQUE PER HOTEL
   * =========================================================
   * Here I must use compound unique: (hotelId, number)
   * Also, Room requires hotelId now.
   */
  const room101 = await prisma.room.upsert({
    where: {
      hotelId_number: { hotelId: hotel.id, number: "101" },
    },
    update: {
      floor: 1,
      description: "Single room",
      roomTypeId: single.id,
      status: "disponible",
    },
    create: {
      hotelId: hotel.id,
      number: "101",
      floor: 1,
      description: "Single room",
      roomTypeId: single.id,
      status: "disponible",
    },
  });

  const room202 = await prisma.room.upsert({
    where: {
      hotelId_number: { hotelId: hotel.id, number: "202" },
    },
    update: {
      floor: 2,
      description: "Double room",
      roomTypeId: double.id,
      status: "disponible",
    },
    create: {
      hotelId: hotel.id,
      number: "202",
      floor: 2,
      description: "Double room",
      roomTypeId: double.id,
      status: "disponible",
    },
  });

  const room301 = await prisma.room.upsert({
    where: {
      hotelId_number: { hotelId: hotel.id, number: "301" },
    },
    update: {
      floor: 3,
      description: "Suite room",
      roomTypeId: suite.id,
      status: "disponible",
    },
    create: {
      hotelId: hotel.id,
      number: "301",
      floor: 3,
      description: "Suite room",
      roomTypeId: suite.id,
      status: "disponible",
    },
  });

  /**
   * =========================================================
   * 5) GUESTS - UNIQUE PER HOTEL (EMAIL OPTIONAL)
   * =========================================================
   * Here I use upsert with compound unique (hotelId, email).
   * I only do this for guests that actually have an email.
   */
  const guestJohn = await prisma.guest.upsert({
    where: {
      hotelId_email: { hotelId: hotel.id, email: "john@example.com" },
    },
    update: {
      name: "John Doe",
      phone: "099 111 222",
    },
    create: {
      hotelId: hotel.id,
      name: "John Doe",
      email: "john@example.com",
      phone: "099 111 222",
    },
  });

  const guestJane = await prisma.guest.upsert({
    where: {
      hotelId_email: { hotelId: hotel.id, email: "jane@example.com" },
    },
    update: {
      name: "Jane Smith",
      phone: "099 333 444",
    },
    create: {
      hotelId: hotel.id,
      name: "Jane Smith",
      email: "jane@example.com",
      phone: "099 333 444",
    },
  });

  /**
   * =========================================================
   * 6) BOOKINGS - MUST INCLUDE hotelId NOW
   * =========================================================
   * Here I create a couple of demo bookings.
   * I keep it simple and avoid upsert because bookings are not unique by a single field.
   * To make this idempotent, I delete previous demo bookings for this hotel first.
   */
  await prisma.booking.deleteMany({
    where: { hotelId: hotel.id },
  });

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const inTwoDays = new Date(now);
  inTwoDays.setDate(inTwoDays.getDate() + 2);

  await prisma.booking.create({
    data: {
      hotelId: hotel.id,
      roomId: room101.id,
      guestId: guestJohn.id,
      userId: admin.id,
      checkIn: now,
      checkOut: tomorrow,
      totalPrice: 80,
      status: "confirmed",
    },
  });

  await prisma.booking.create({
    data: {
      hotelId: hotel.id,
      roomId: room202.id,
      guestId: guestJane.id,
      userId: receptionist.id,
      checkIn: tomorrow,
      checkOut: inTwoDays,
      totalPrice: 120,
      status: "pending",
    },
  });

  console.log("✅ Seed completed");
  console.log("Hotel:", { id: hotel.id, code: hotel.code, name: hotel.name });
  console.log("Admin login:", {
    hotelCode: hotel.code,
    email: "admin@hotel.com",
    password: "admin123",
  });
  console.log("Reception login:", {
    hotelCode: hotel.code,
    email: "reception@hotel.com",
    password: "recep123",
  });
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
