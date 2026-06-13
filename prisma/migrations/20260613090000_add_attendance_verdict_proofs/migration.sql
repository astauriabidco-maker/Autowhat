ALTER TABLE "Attendance" ADD COLUMN "verdictReason" TEXT;
ALTER TABLE "Attendance" ADD COLUMN "gpsVerdict" TEXT;
ALTER TABLE "Attendance" ADD COLUMN "gpsCheckedAt" TIMESTAMP(3);
ALTER TABLE "Attendance" ADD COLUMN "proofReceivedAt" TIMESTAMP(3);
