-- Add optional manager comment tracking for leave/absence inbox decisions.
ALTER TABLE "LeaveRequest"
ADD COLUMN "managerComment" TEXT;
