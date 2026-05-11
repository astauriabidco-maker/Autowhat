-- AlterTable
ALTER TABLE "InterventionRequest" ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "lastEventAt" TIMESTAMP(3),
ADD COLUMN     "lastInternalCommentAt" TIMESTAMP(3),
ADD COLUMN     "slaBreachedAt" TIMESTAMP(3),
ADD COLUMN     "slaDueAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RequestEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'INTERNAL',
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequestEvent_tenantId_entityType_entityId_createdAt_idx" ON "RequestEvent"("tenantId", "entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "RequestEvent_tenantId_type_createdAt_idx" ON "RequestEvent"("tenantId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "InterventionRequest_tenantId_assignedToId_status_idx" ON "InterventionRequest"("tenantId", "assignedToId", "status");

-- CreateIndex
CREATE INDEX "InterventionRequest_tenantId_slaDueAt_idx" ON "InterventionRequest"("tenantId", "slaDueAt");

-- AddForeignKey
ALTER TABLE "InterventionRequest" ADD CONSTRAINT "InterventionRequest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
