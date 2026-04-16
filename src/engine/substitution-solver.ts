export type SolutionType =
  | "SUBSTITUTE_TEACHER"
  | "CANCEL_LESSON"
  | "MERGE_CLASSES"
  | "TIME_SWAP"
  | "DISSOLVE_STUDY_GROUP"
  | "DISTRIBUTE_TO_HOMEROOM"
  | "SELF_STUDY";

export interface SlotInfo {
  id: string;
  day: number;
  period: number;
  classId: string;
  className: string;
  classGrade: number;
  teacherId: string;
  teacherName: string;
  subjectId: string;
  subjectName: string;
  roomId: string | null;
  roomName: string | null;
  studyGroupId: string | null;
}

export interface TeacherInfo {
  id: string;
  name: string;
  subjectIds: string[];
  homeroomClassIds: string[];
  maxHoursPerWeek: number;
}

export interface Suggestion {
  type: SolutionType;
  score: number;
  description: string;
  details: Record<string, unknown>;
}

interface SolverInput {
  absenceTeacherId: string;
  date: string; // YYYY-MM-DD
  day: number; // 0=Sun..5=Fri
  period: number;
  affectedSlot: SlotInfo;
  allSlots: SlotInfo[]; // all slots for this day
  allTeachers: TeacherInfo[];
  teacherAbsences: string[]; // teacher IDs absent today
  teacherConstraints: { teacherId: string; type: string; day: number | null; period: number | null }[];
}

/**
 * Check if a teacher is available for a given day+period
 * (not already teaching, not absent, no hard constraint)
 */
function isTeacherFree(
  teacherId: string,
  day: number,
  period: number,
  allSlots: SlotInfo[],
  absentTeacherIds: string[],
  constraints: { teacherId: string; type: string; day: number | null; period: number | null }[]
): boolean {
  if (absentTeacherIds.includes(teacherId)) return false;

  const alreadyTeaching = allSlots.some(
    (s) => s.teacherId === teacherId && s.period === period
  );
  if (alreadyTeaching) return false;

  const blocked = constraints.some(
    (c) =>
      c.teacherId === teacherId &&
      c.type === "UNAVAILABLE" &&
      (c.day === null || c.day === day) &&
      (c.period === null || c.period === period)
  );
  return !blocked;
}

/**
 * Generate ranked substitution suggestions for a single affected period
 */
export function generateSuggestions(input: SolverInput): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const {
    day,
    period,
    affectedSlot,
    allSlots,
    allTeachers,
    teacherAbsences,
    teacherConstraints,
  } = input;

  const absentAndConflict = [...teacherAbsences, input.absenceTeacherId];

  // ── A: Direct Substitute ──────────────────────────────────────────────────
  for (const teacher of allTeachers) {
    if (teacher.id === input.absenceTeacherId) continue;
    if (!isTeacherFree(teacher.id, day, period, allSlots, absentAndConflict, teacherConstraints))
      continue;

    let score = 45;
    const reasons: string[] = [];

    // +30 teaches same subject
    if (teacher.subjectIds.includes(affectedSlot.subjectId)) {
      score += 30;
      reasons.push("מלמד את המקצוע");
    }

    // +15 already has lessons today (in school)
    const teachesToday = allSlots.some((s) => s.teacherId === teacher.id);
    if (teachesToday) {
      score += 15;
      reasons.push("נמצא בבית הספר היום");
    }

    // +10 taught this class before (has slots for this class)
    const knownClass = allSlots.some(
      (s) => s.teacherId === teacher.id && s.classId === affectedSlot.classId
    );
    if (knownClass) {
      score += 10;
      reasons.push("מכיר את הכיתה");
    }

    const reasonStr = reasons.length > 0 ? ` (${reasons.join(", ")})` : "";
    suggestions.push({
      type: "SUBSTITUTE_TEACHER",
      score,
      description: `${teacher.name} יחליף${reasonStr}`,
      details: {
        substituteTeacherId: teacher.id,
        substituteTeacherName: teacher.name,
      },
    });
  }

  // ── B: Merge Classes ──────────────────────────────────────────────────────
  // Find another class in the same period with the same subject and a free teacher
  const parallelSlots = allSlots.filter(
    (s) =>
      s.period === period &&
      s.subjectId === affectedSlot.subjectId &&
      s.classId !== affectedSlot.classId &&
      s.classGrade === affectedSlot.classGrade
  );
  for (const parallel of parallelSlots) {
    suggestions.push({
      type: "MERGE_CLASSES",
      score: 58,
      description: `מיזוג עם ${parallel.className} (${parallel.teacherName} מלמד)`,
      details: {
        mergeIntoClassId: parallel.classId,
        mergeIntoClassName: parallel.className,
        hostTeacherId: parallel.teacherId,
        hostTeacherName: parallel.teacherName,
      },
    });
  }

  // ── C: Time Swap ─────────────────────────────────────────────────────────
  // Find a later period where the class has a lesson whose teacher IS free right now
  const classOtherSlots = allSlots.filter(
    (s) => s.classId === affectedSlot.classId && s.period !== period
  );
  for (const laterSlot of classOtherSlots) {
    if (laterSlot.period <= period) continue; // only swap with later lessons
    const swapTeacher = laterSlot.teacherId;
    if (
      isTeacherFree(swapTeacher, day, period, allSlots, absentAndConflict, teacherConstraints)
    ) {
      suggestions.push({
        type: "TIME_SWAP",
        score: 48,
        description: `החלפת שיעורים: ${affectedSlot.subjectName} (${period + 1}) ↔ ${laterSlot.subjectName} (${laterSlot.period + 1})`,
        details: {
          swapPeriod: laterSlot.period,
          swapSubjectId: laterSlot.subjectId,
          swapSubjectName: laterSlot.subjectName,
          swapTeacherId: swapTeacher,
          swapTeacherName: laterSlot.teacherName,
        },
      });
      break; // one swap suggestion is enough
    }
  }

  // ── D: Distribute to Homeroom ─────────────────────────────────────────────
  const homeroomTeacher = allTeachers.find((t) =>
    t.homeroomClassIds.includes(affectedSlot.classId)
  );
  if (
    homeroomTeacher &&
    isTeacherFree(homeroomTeacher.id, day, period, allSlots, absentAndConflict, teacherConstraints)
  ) {
    suggestions.push({
      type: "DISTRIBUTE_TO_HOMEROOM",
      score: 30,
      description: `${homeroomTeacher.name} (מחנך/ת) יקבל/תקבל את הכיתה לשיעור עצמי`,
      details: {
        homeroomTeacherId: homeroomTeacher.id,
        homeroomTeacherName: homeroomTeacher.name,
      },
    });
  }

  // ── E: Self Study ─────────────────────────────────────────────────────────
  suggestions.push({
    type: "SELF_STUDY",
    score: 20,
    description: "שיעור עצמי — הכיתה בפיקוח עצמי",
    details: {},
  });

  // ── F: Cancel Lesson ──────────────────────────────────────────────────────
  suggestions.push({
    type: "CANCEL_LESSON",
    score: 10,
    description: "ביטול השיעור",
    details: {},
  });

  // Sort by score descending
  return suggestions.sort((a, b) => b.score - a.score);
}
