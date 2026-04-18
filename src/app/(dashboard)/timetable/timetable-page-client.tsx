"use client";

import { useState } from "react";
import { TimetableClient } from "@/components/timetable/TimetableClient";
import type { TimetableSlot } from "@/stores/timetable-store";

type StudyGroup = {
  id: string;
  name: string;
  subjectId: string;
  level: string | null;
  teacher: { id: string; name: string };
  subject: { id: string; name: string; color: string | null };
  classes: { classId: string }[];
};

interface TimetablePageClientProps {
  initialData: {
    slots: TimetableSlot[];
    teachers: { id: string; name: string; maxHoursPerWeek: number | null; subjects: { subject: { id: string; name: string; color: string | null } }[] }[];
    classes: {
      id: string;
      name: string;
      grade: number;
      studentCount: number;
      homeroomTeacherId: string | null;
      layerAllowedRoomIds: string[] | null;
      excludedTeacherIds: string[];
    }[];
    subjects: { id: string; name: string; color: string | null }[];
    rooms: { id: string; name: string; capacity: number }[];
    constraints: { teacherId: string; type: string; day: number | null; period: number | null }[];
    studyGroups: StudyGroup[];
  };
  periodCount: number;
  dayCount?: number;
  periodTimes?: { start: string; end: string }[];
}

export function TimetablePageClient({ initialData, periodCount, dayCount = 6, periodTimes }: TimetablePageClientProps) {
  const [selectedClassId, setSelectedClassId] = useState<string | null>(
    initialData.classes[0]?.id ?? null
  );

  return (
    <TimetableClient
      initialSlots={initialData.slots}
      teachers={initialData.teachers}
      classes={initialData.classes}
      subjects={initialData.subjects}
      rooms={initialData.rooms}
      constraints={initialData.constraints}
      studyGroups={initialData.studyGroups}
      periodCount={periodCount}
      dayCount={dayCount}
      periodTimes={periodTimes}
      selectedClassId={selectedClassId}
      onClassChange={(id) => setSelectedClassId(id || null)}
    />
  );
}
