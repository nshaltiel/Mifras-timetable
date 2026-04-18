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
 * Generate ranked substitution suggestions for a single affected period.
 *
 * Priority order for substitute teachers (all require: free this period + at school today):
 *   1. Teaches the same subject                 → score 100
 *   2. Teaches this class (different subject)   → score 80
 *   3. Generic – at school, no special tie      → score 60
 *   4. Homeroom teacher of this class           → score 40  (DISTRIBUTE_TO_HOMEROOM)
 *   5. Self-study                               → score 20
 *   6. Cancel lesson                            → score 10
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

  const homeroomTeacher = allTeachers.find((t) =>
    t.homeroomClassIds.includes(affectedSlot.classId)
  );

  // ── Substitute teachers ───────────────────────────────────────────────────
  for (const teacher of allTeachers) {
    if (teacher.id === input.absenceTeacherId) continue;
    if (!isTeacherFree(teacher.id, day, period, allSlots, absentAndConflict, teacherConstraints))
      continue;

    // Only show teachers who are physically at school today
    const atSchool = allSlots.some((s) => s.teacherId === teacher.id);
    if (!atSchool) continue;

    const teachesSubject = teacher.subjectIds.includes(affectedSlot.subjectId);
    const teachesClass = allSlots.some(
      (s) => s.teacherId === teacher.id && s.classId === affectedSlot.classId
    );
    const isHomeroom = teacher.id === homeroomTeacher?.id;

    let score: number;
    let reason: string;

    if (teachesSubject) {
      score = 100;
      reason = "מלמד את המקצוע";
    } else if (teachesClass) {
      score = 80;
      reason = "מלמד את הכיתה";
    } else if (isHomeroom) {
      // Homeroom teacher without subject/class match → supervision role (group 4)
      score = 40;
      reason = "מחנך/ת הכיתה";
      suggestions.push({
        type: "DISTRIBUTE_TO_HOMEROOM",
        score,
        description: `${teacher.name} (מחנך/ת) יקבל/תקבל את הכיתה`,
        details: {
          homeroomTeacherId: teacher.id,
          homeroomTeacherName: teacher.name,
        },
      });
      continue;
    } else {
      score = 60;
      reason = "נמצא בבית הספר היום";
    }

    suggestions.push({
      type: "SUBSTITUTE_TEACHER",
      score,
      description: `${teacher.name} יחליף (${reason})`,
      details: {
        substituteTeacherId: teacher.id,
        substituteTeacherName: teacher.name,
      },
    });
  }

  // ── Self Study ────────────────────────────────────────────────────────────
  suggestions.push({
    type: "SELF_STUDY",
    score: 20,
    description: "שיעור עצמי — הכיתה בפיקוח עצמי",
    details: {},
  });

  // ── Cancel Lesson ─────────────────────────────────────────────────────────
  suggestions.push({
    type: "CANCEL_LESSON",
    score: 10,
    description: "ביטול השיעור",
    details: {},
  });

  return suggestions.sort((a, b) => b.score - a.score);
}
