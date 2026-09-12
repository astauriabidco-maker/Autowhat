CREATE TYPE "SystemPhoneNumberChannelType" AS ENUM ('SHARED', 'DEDICATED', 'BYON');

CREATE TYPE "SystemPhoneNumberSetupStatus" AS ENUM ('PENDING_MANUAL_SETUP', 'ACTIVE', 'SUSPENDED', 'FAILED');

ALTER TABLE "SystemPhoneNumber"
ADD COLUMN "channelType" "SystemPhoneNumberChannelType" NOT NULL DEFAULT 'SHARED',
ADD COLUMN "setupStatus" "SystemPhoneNumberSetupStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "maxTenants" INTEGER NOT NULL DEFAULT 50;

CREATE INDEX "SystemPhoneNumber_routing_status_idx"
ON "SystemPhoneNumber"("countryCode", "isActive", "channelType", "setupStatus");
