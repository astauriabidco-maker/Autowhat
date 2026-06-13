-- CreateTable
CREATE TABLE "AttendanceDecisionEvent" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousStatus" TEXT NOT NULL,
    "nextStatus" TEXT NOT NULL,
    "previousGpsVerdict" TEXT,
    "nextGpsVerdict" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attendanceId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "managerId" TEXT,

    CONSTRAINT "AttendanceDecisionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceDecisionEvent_attendanceId_createdAt_idx" ON "AttendanceDecisionEvent"("attendanceId", "createdAt");

-- CreateIndex
CREATE INDEX "AttendanceDecisionEvent_tenantId_createdAt_idx" ON "AttendanceDecisionEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AttendanceDecisionEvent_managerId_createdAt_idx" ON "AttendanceDecisionEvent"("managerId", "createdAt");

-- AddForeignKey
ALTER TABLE "AttendanceDecisionEvent" ADD CONSTRAINT "AttendanceDecisionEvent_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDecisionEvent" ADD CONSTRAINT "AttendanceDecisionEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDecisionEvent" ADD CONSTRAINT "AttendanceDecisionEvent_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
