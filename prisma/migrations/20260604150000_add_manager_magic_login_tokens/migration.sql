CREATE TABLE "ManagerMagicLoginToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "redirectTo" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagerMagicLoginToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManagerMagicLoginToken_tokenHash_key" ON "ManagerMagicLoginToken"("tokenHash");
CREATE INDEX "ManagerMagicLoginToken_employeeId_idx" ON "ManagerMagicLoginToken"("employeeId");
CREATE INDEX "ManagerMagicLoginToken_tenantId_idx" ON "ManagerMagicLoginToken"("tenantId");
CREATE INDEX "ManagerMagicLoginToken_expiresAt_idx" ON "ManagerMagicLoginToken"("expiresAt");
CREATE INDEX "ManagerMagicLoginToken_usedAt_idx" ON "ManagerMagicLoginToken"("usedAt");

ALTER TABLE "ManagerMagicLoginToken"
    ADD CONSTRAINT "ManagerMagicLoginToken_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ManagerMagicLoginToken"
    ADD CONSTRAINT "ManagerMagicLoginToken_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
