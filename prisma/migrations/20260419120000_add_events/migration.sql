-- Event table
CREATE TABLE "Event" (
  "id"          TEXT NOT NULL,
  "schoolId"    TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "eventType"   TEXT,
  "startAt"     TIMESTAMP(3) NOT NULL,
  "endAt"       TIMESTAMP(3) NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Event_schoolId_startAt_idx" ON "Event"("schoolId", "startAt");

ALTER TABLE "Event"
  ADD CONSTRAINT "Event_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EventClass junction
CREATE TABLE "EventClass" (
  "eventId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  CONSTRAINT "EventClass_pkey" PRIMARY KEY ("eventId", "classId")
);

ALTER TABLE "EventClass"
  ADD CONSTRAINT "EventClass_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventClass"
  ADD CONSTRAINT "EventClass_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EventTeacher junction
CREATE TABLE "EventTeacher" (
  "eventId"   TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  CONSTRAINT "EventTeacher_pkey" PRIMARY KEY ("eventId", "teacherId")
);

ALTER TABLE "EventTeacher"
  ADD CONSTRAINT "EventTeacher_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventTeacher"
  ADD CONSTRAINT "EventTeacher_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Absence.eventId link
ALTER TABLE "Absence" ADD COLUMN "eventId" TEXT;

ALTER TABLE "Absence"
  ADD CONSTRAINT "Absence_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
