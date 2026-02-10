-- CreateTable
CREATE TABLE "StayRegistration" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hotelId" INTEGER NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "roomId" INTEGER NOT NULL,
    "guestId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "guestName" TEXT NOT NULL,
    "nationality" TEXT,
    "documentType" TEXT,
    "documentNumber" TEXT,
    "birthDate" DATETIME,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "notes" TEXT,
    "checkedInAt" DATETIME,
    "checkedOutAt" DATETIME,
    CONSTRAINT "StayRegistration_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StayRegistration_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StayRegistration_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StayRegistration_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Charge" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hotelId" INTEGER NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "roomId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    CONSTRAINT "Charge_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Charge_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Charge_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StayRegistration_bookingId_key" ON "StayRegistration"("bookingId");

-- CreateIndex
CREATE INDEX "StayRegistration_hotelId_roomId_idx" ON "StayRegistration"("hotelId", "roomId");

-- CreateIndex
CREATE INDEX "StayRegistration_hotelId_guestId_idx" ON "StayRegistration"("hotelId", "guestId");

-- CreateIndex
CREATE INDEX "Charge_hotelId_bookingId_idx" ON "Charge"("hotelId", "bookingId");

-- CreateIndex
CREATE INDEX "Charge_hotelId_roomId_idx" ON "Charge"("hotelId", "roomId");
