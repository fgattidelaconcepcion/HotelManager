/*
  Warnings:

  - You are about to drop the column `quantity` on the `Charge` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `StayRegistration` table. All the data in the column will be lost.
  - Added the required column `scheduledCheckIn` to the `StayRegistration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `scheduledCheckOut` to the `StayRegistration` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Guest" ADD COLUMN "birthDate" DATETIME;
ALTER TABLE "Guest" ADD COLUMN "city" TEXT;
ALTER TABLE "Guest" ADD COLUMN "country" TEXT;
ALTER TABLE "Guest" ADD COLUMN "documentType" TEXT;
ALTER TABLE "Guest" ADD COLUMN "gender" TEXT;
ALTER TABLE "Guest" ADD COLUMN "nationality" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Charge" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hotelId" INTEGER NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "roomId" INTEGER NOT NULL,
    "createdById" INTEGER,
    "category" TEXT NOT NULL DEFAULT 'other',
    "description" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Charge_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Charge_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Charge_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Charge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Charge" ("bookingId", "createdAt", "description", "hotelId", "id", "roomId", "total", "unitPrice", "updatedAt") SELECT "bookingId", "createdAt", "description", "hotelId", "id", "roomId", "total", "unitPrice", "updatedAt" FROM "Charge";
DROP TABLE "Charge";
ALTER TABLE "new_Charge" RENAME TO "Charge";
CREATE INDEX "Charge_hotelId_bookingId_idx" ON "Charge"("hotelId", "bookingId");
CREATE INDEX "Charge_hotelId_roomId_idx" ON "Charge"("hotelId", "roomId");
CREATE INDEX "Charge_createdById_idx" ON "Charge"("createdById");
CREATE TABLE "new_StayRegistration" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hotelId" INTEGER NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "roomId" INTEGER NOT NULL,
    "guestId" INTEGER,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestEmail" TEXT,
    "guestPhone" TEXT,
    "nationality" TEXT,
    "documentType" TEXT,
    "documentNumber" TEXT,
    "birthDate" DATETIME,
    "gender" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "scheduledCheckIn" DATETIME NOT NULL,
    "scheduledCheckOut" DATETIME NOT NULL,
    "checkedInAt" DATETIME,
    "checkedOutAt" DATETIME,
    CONSTRAINT "StayRegistration_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StayRegistration_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StayRegistration_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StayRegistration_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StayRegistration_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StayRegistration" ("address", "birthDate", "bookingId", "checkedInAt", "checkedOutAt", "city", "country", "createdAt", "documentNumber", "documentType", "guestId", "guestName", "hotelId", "id", "nationality", "roomId", "updatedAt") SELECT "address", "birthDate", "bookingId", "checkedInAt", "checkedOutAt", "city", "country", "createdAt", "documentNumber", "documentType", "guestId", "guestName", "hotelId", "id", "nationality", "roomId", "updatedAt" FROM "StayRegistration";
DROP TABLE "StayRegistration";
ALTER TABLE "new_StayRegistration" RENAME TO "StayRegistration";
CREATE UNIQUE INDEX "StayRegistration_bookingId_key" ON "StayRegistration"("bookingId");
CREATE INDEX "StayRegistration_hotelId_roomId_idx" ON "StayRegistration"("hotelId", "roomId");
CREATE INDEX "StayRegistration_hotelId_guestId_idx" ON "StayRegistration"("hotelId", "guestId");
CREATE INDEX "StayRegistration_createdById_idx" ON "StayRegistration"("createdById");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Booking_hotelId_roomId_idx" ON "Booking"("hotelId", "roomId");

-- CreateIndex
CREATE INDEX "Booking_hotelId_guestId_idx" ON "Booking"("hotelId", "guestId");

-- CreateIndex
CREATE INDEX "Payment_bookingId_idx" ON "Payment"("bookingId");
