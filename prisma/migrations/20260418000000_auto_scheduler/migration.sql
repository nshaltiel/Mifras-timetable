-- Add maxConcurrentClasses to Room
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "maxConcurrentClasses" INTEGER NOT NULL DEFAULT 1;

-- Create ClassSubjectRequirement table
CREATE TABLE IF NOT EXISTS "ClassSubjectRequirement" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "hoursPerWeek" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ClassSubjectRequirement_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "ClassSubjectRequirement_classId_subjectId_key"
    ON "ClassSubjectRequirement"("classId", "subjectId");

-- Add foreign keys
ALTER TABLE "ClassSubjectRequirement"
    ADD CONSTRAINT "ClassSubjectRequirement_classId_fkey"
    FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClassSubjectRequirement"
    ADD CONSTRAINT "ClassSubjectRequirement_subjectId_fkey"
    FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
