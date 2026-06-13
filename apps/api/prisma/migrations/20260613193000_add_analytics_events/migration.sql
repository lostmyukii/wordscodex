CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "clientEventId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "properties" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnalyticsEvent_clientEventId_key" ON "AnalyticsEvent"("clientEventId");
CREATE INDEX "AnalyticsEvent_userId_occurredAt_idx" ON "AnalyticsEvent"("userId", "occurredAt");
CREATE INDEX "AnalyticsEvent_name_occurredAt_idx" ON "AnalyticsEvent"("name", "occurredAt");

ALTER TABLE "AnalyticsEvent"
ADD CONSTRAINT "AnalyticsEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
