-- Add splitGroupId column
ALTER TABLE "TimetableSlot" ADD COLUMN "splitGroupId" TEXT;

-- Drop the blocking unique constraint (one slot per class per period)
DROP INDEX "TimetableSlot_day_period_classId_key";

-- Partial unique index: at most one slot per (day, period, classId) when NOT part of a split
CREATE UNIQUE INDEX "TimetableSlot_day_period_classId_nosplit_key"
  ON "TimetableSlot"("day", "period", "classId")
  WHERE "splitGroupId" IS NULL;

-- Index for fast split-partner lookup
CREATE INDEX "TimetableSlot_splitGroupId_idx" ON "TimetableSlot"("splitGroupId");
