-- Add durable timestamps for employee lifecycle and WhatsApp onboarding tracking.
ALTER TABLE "Employee" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Employee" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "WhatsAppConversationSession" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL DEFAULT 'default',
    "kind" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "data" JSONB,
    "tenantId" TEXT,
    "employeeId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppConversationSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OnboardingEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "metadata" JSONB,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppConversationSession_phoneNumberId_phoneNumber_kind_key"
    ON "WhatsAppConversationSession"("phoneNumberId", "phoneNumber", "kind");
CREATE INDEX "WhatsAppConversationSession_expiresAt_idx" ON "WhatsAppConversationSession"("expiresAt");
CREATE INDEX "WhatsAppConversationSession_tenantId_idx" ON "WhatsAppConversationSession"("tenantId");
CREATE INDEX "WhatsAppConversationSession_employeeId_kind_idx" ON "WhatsAppConversationSession"("employeeId", "kind");

CREATE INDEX "OnboardingEvent_tenantId_type_idx" ON "OnboardingEvent"("tenantId", "type");
CREATE INDEX "OnboardingEvent_employeeId_type_idx" ON "OnboardingEvent"("employeeId", "type");
CREATE INDEX "OnboardingEvent_createdAt_idx" ON "OnboardingEvent"("createdAt");

ALTER TABLE "WhatsAppConversationSession"
    ADD CONSTRAINT "WhatsAppConversationSession_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WhatsAppConversationSession"
    ADD CONSTRAINT "WhatsAppConversationSession_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OnboardingEvent"
    ADD CONSTRAINT "OnboardingEvent_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OnboardingEvent"
    ADD CONSTRAINT "OnboardingEvent_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
