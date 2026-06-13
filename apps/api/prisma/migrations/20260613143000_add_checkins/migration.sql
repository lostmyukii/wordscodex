-- CreateTable
CREATE TABLE "Checkin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedSessions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Checkin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Checkin_userId_dateKey_key" ON "Checkin"("userId", "dateKey");

-- CreateIndex
CREATE INDEX "Checkin_userId_dateKey_idx" ON "Checkin"("userId", "dateKey");

-- CreateIndex
CREATE INDEX "Checkin_checkedInAt_idx" ON "Checkin"("checkedInAt");

-- AddForeignKey
ALTER TABLE "Checkin" ADD CONSTRAINT "Checkin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
