-- CreateEnum
CREATE TYPE "OnboardingAccessRequestStatus" AS ENUM ('SENT', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "OnboardingAccessRequestSkipReason" AS ENUM (
    'PHONE_INVALID',
    'COUNTRY_NOT_ALLOWED',
    'PHONE_RATE_LIMITED',
    'IP_RATE_LIMITED',
    'COOLDOWN_ACTIVE',
    'GLOBAL_DAILY_BUDGET_EXCEEDED',
    'COUNTRY_DAILY_BUDGET_EXCEEDED',
    'DISPOSABLE_OR_VOIP',
    'CHALLENGE_REQUIRED',
    'CHALLENGE_FAILED',
    'SEND_FAILED'
);

-- CreateTable
CREATE TABLE "OnboardingAccessRequest" (
    "id" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "countryCode" TEXT NOT NULL,
    "status" "OnboardingAccessRequestStatus" NOT NULL,
    "skipReason" "OnboardingAccessRequestSkipReason",
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "provider" TEXT,
    "providerMessageId" TEXT,
    "challengeProvider" TEXT,
    "challengePassed" BOOLEAN,
    "metadata" JSONB,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OnboardingAccessRequest_phoneHash_requestedAt_idx" ON "OnboardingAccessRequest"("phoneHash", "requestedAt");

-- CreateIndex
CREATE INDEX "OnboardingAccessRequest_ipHash_requestedAt_idx" ON "OnboardingAccessRequest"("ipHash", "requestedAt");

-- CreateIndex
CREATE INDEX "OnboardingAccessRequest_countryCode_requestedAt_idx" ON "OnboardingAccessRequest"("countryCode", "requestedAt");

-- CreateIndex
CREATE INDEX "OnboardingAccessRequest_status_requestedAt_idx" ON "OnboardingAccessRequest"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "OnboardingAccessRequest_skipReason_requestedAt_idx" ON "OnboardingAccessRequest"("skipReason", "requestedAt");
