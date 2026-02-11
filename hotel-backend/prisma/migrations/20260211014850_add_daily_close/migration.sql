-- CreateTable
CREATE TABLE "DailyClose" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hotelId" INTEGER NOT NULL,
    "dateKey" TEXT NOT NULL,
    "totalCompleted" INTEGER NOT NULL,
    "countCompleted" INTEGER NOT NULL,
    "byMethod" JSONB,
    "createdById" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyClose_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DailyClose_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DailyClose_hotelId_dateKey_idx" ON "DailyClose"("hotelId", "dateKey");

-- CreateIndex
CREATE INDEX "DailyClose_createdById_idx" ON "DailyClose"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "DailyClose_hotelId_dateKey_key" ON "DailyClose"("hotelId", "dateKey");
