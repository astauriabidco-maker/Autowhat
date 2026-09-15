CREATE TABLE "PartnerConnector" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "docsUrl" TEXT,
    "openApiUrl" TEXT,
    "requiredEvents" TEXT[],
    "searchTerms" TEXT[],
    "sandboxEndpoint" TEXT NOT NULL,
    "productionEndpoint" TEXT NOT NULL,
    "requiresTenantScopedEvents" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerConnector_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerConnector_provider_key" ON "PartnerConnector"("provider");
CREATE INDEX "PartnerConnector_isActive_idx" ON "PartnerConnector"("isActive");
