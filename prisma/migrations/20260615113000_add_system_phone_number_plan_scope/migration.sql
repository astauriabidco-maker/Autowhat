ALTER TABLE "SystemPhoneNumber"
ADD COLUMN "planScope" TEXT NOT NULL DEFAULT 'ANY';

CREATE INDEX "SystemPhoneNumber_routing_plan_idx"
ON "SystemPhoneNumber"("countryCode", "isActive", "channelType", "setupStatus", "planScope");
