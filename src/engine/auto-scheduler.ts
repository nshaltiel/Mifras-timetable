/**
 * Auto-scheduler engine — pure function, no I/O.
 *
 * Takes a class's subject requirements, the school's existing slots,
 * available teachers/rooms/constraints, and returns a list of new slots
 * to place (plus unplaced requirements that couldn't fit).
 */

export interface SchedulerSlot {
  day: number;
  period: number;
  classId: string;
  teacherId: string;
  subjectId: string;
  roomId: string | null;
  studyGroupId: string | null;
  // display
  subjectName: string;
  subjectColor: string;
  teacherName: string;
  className: string;
  roomName?: string;
}

export interface Requirement {
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  hoursPerWeek: number;
  /** Candidate teachers for this subject (for this class). First = preferred. */
  candidateTeachers: { id: string; name: string; maxHoursPerWeek?: number | null }[];
  studyGroupId: string | null;
  /** If set, only this teacher can be assigned (homeroom subject). */
  forcedTeacherId?: string | null;
  /** If true, this subject must not be placed adjacent to another lesson of itself on the same day. */
  noConsecutive?: boolean;
}

export interface ExistingSlot {
  day: number;
  period: number;
  classId: string;
  teacherId: string;
  roomId?: string | null;
  studyGroupId?: string | null;
}

export interface RoomOption {
  id: string;
  name: string;
  capacity: number;
  maxConcurrentClasses: number;
}

export interface ConstraintEntry {
  teacherId: string;
  type: string; // "UNAVAILABLE" | "AVOID" | "PREFER"
  day: number | null;
  period: number | null;
}

export interface SchedulerInput {
  classId: string;
  className: string;
  classStudentCount: number;
  requirements: Requirement[];
  existingSlots: ExistingSlot[];  // ALL slots across the school (including already-scheduled for this class)
  rooms: RoomOption[];
  constraints: ConstraintEntry[];
  dayCount: number;
  periodCount: number;
  /** Per-day last allowed period (0-based, inclusive). If omitted, all days use periodCount-1. */
  dayLastPeriods?: number[];
  /**
   * IDs of rooms allowed for this class's layer.
   * null = any room allowed; [] = no rooms restricted (any allowed).
   */
  allowedRoomIds?: string[] | null;
  /**
   * Teacher IDs excluded from teaching this class (TeacherExcludedClass rows).
   */
  excludedTeacherIds?: string[];
}

export interface SchedulerOutput {
  placed: SchedulerSlot[];
  unplaced: { subjectName: string; remaining: number; reason: string }[];
}

// ─── helpers ────────────────────────────────────────────────────────────────

function isTeacherUnavailable(
  teacherId: string,
  day: number,
  period: number,
  constraints: ConstraintEntry[]
): boolean {
  return constraints.some(
    (c) =>
      c.teacherId === teacherId &&
      c.type === "UNAVAILABLE" &&
      (c.day == null || c.day === day) &&
      (c.period == null || c.period === period)
  );
}

function isTeacherBooked(
  teacherId: string,
  day: number,
  period: number,
  slots: ExistingSlot[]
): boolean {
  return slots.some((s) => s.teacherId === teacherId && s.day === day && s.period === period);
}

function isClassBooked(
  classId: string,
  day: number,
  period: number,
  slots: ExistingSlot[]
): boolean {
  return slots.some((s) => s.classId === classId && s.day === day && s.period === period);
}

/**
 * Returns how many classes are currently using this room at day+period.
 */
function roomOccupancy(roomId: string, day: number, period: number, slots: ExistingSlot[]): number {
  return slots.filter((s) => s.roomId === roomId && s.day === day && s.period === period).length;
}

/**
 * Finds a suitable room for a class at day+period.
 * Returns null if no room is available.
 * allowedRoomIds: null = all rooms OK; defined array = filter to those IDs.
 */
function findRoom(
  studentCount: number,
  day: number,
  period: number,
  slots: ExistingSlot[],
  rooms: RoomOption[],
  allowedRoomIds?: string[] | null
): RoomOption | null {
  const pool =
    allowedRoomIds != null && allowedRoomIds.length > 0
      ? rooms.filter((r) => allowedRoomIds.includes(r.id))
      : rooms;

  const candidates = pool.filter(
    (r) =>
      (r.capacity === 0 || r.capacity >= studentCount) &&
      roomOccupancy(r.id, day, period, slots) < r.maxConcurrentClasses
  );
  if (candidates.length === 0) return null;
  // Prefer rooms with capacity closest to (but >=) studentCount to avoid wasting big rooms
  candidates.sort((a, b) => {
    const diffA = a.capacity === 0 ? 9999 : a.capacity - studentCount;
    const diffB = b.capacity === 0 ? 9999 : b.capacity - studentCount;
    return diffA - diffB;
  });
  return candidates[0];
}

// ─── Slot scoring (lower = better) ──────────────────────────────────────────

interface SlotScore {
  day: number;
  period: number;
  score: number; // lower = preferred
}

/**
 * Score a candidate slot for placement.
 * Priority: adjacent to existing lessons for the class on same day (no gap),
 * then balance across days.
 */
function scoreSlot(
  day: number,
  period: number,
  classId: string,
  allSlots: ExistingSlot[]
): number {
  const daySlots = allSlots
    .filter((s) => s.classId === classId && s.day === day)
    .map((s) => s.period)
    .sort((a, b) => a - b);

  if (daySlots.length === 0) {
    // New day — prefer earlier periods (period 0 best)
    // Penalty: how many days already have lessons (prefer spreading but not at the cost of gaps)
    const daysWithLessons = new Set(allSlots.filter((s) => s.classId === classId).map((s) => s.day)).size;
    return 1000 + daysWithLessons * 10 + period;
  }

  const min = daySlots[0];
  const max = daySlots[daySlots.length - 1];

  // Check if placing here would create a gap
  const wouldCreateGap =
    period < min - 1 || period > max + 1;

  if (wouldCreateGap) {
    return 99999; // strongly avoid gaps
  }

  // Adjacent to existing block — excellent
  // Prefer to extend earlier rather than later
  return period <= min ? 0 + (min - period) : 1 + (period - max);
}

// ─── Main function ───────────────────────────────────────────────────────────

export function runAutoScheduler(input: SchedulerInput): SchedulerOutput {
  const {
    classId, className, classStudentCount, requirements,
    dayCount, periodCount, rooms, constraints,
    allowedRoomIds, excludedTeacherIds,
  } = input;

  // Working copy of slots — we append as we place
  const slots: ExistingSlot[] = [...input.existingSlots];

  const placed: SchedulerSlot[] = [];
  const unplaced: SchedulerOutput["unplaced"] = [];

  // Pre-count existing hours per teacher across the whole school schedule.
  // Study group slots are deduplicated: if the same teacher teaches the same group at the same
  // (day, period) for multiple classes, it counts as one session, not one per class.
  const teacherHoursUsed = new Map<string, number>();
  const seenSgSlots = new Set<string>();
  for (const s of input.existingSlots) {
    if (s.studyGroupId) {
      const key = `${s.teacherId}:${s.studyGroupId}:${s.day}:${s.period}`;
      if (seenSgSlots.has(key)) continue;
      seenSgSlots.add(key);
    }
    teacherHoursUsed.set(s.teacherId, (teacherHoursUsed.get(s.teacherId) ?? 0) + 1);
  }

  for (const req of requirements) {
    // Resolve effective candidate list, respecting forcedTeacherId and excludedTeacherIds
    let effectiveCandidates = req.candidateTeachers;
    if (req.forcedTeacherId) {
      effectiveCandidates = effectiveCandidates.filter((t) => t.id === req.forcedTeacherId);
    }
    if (excludedTeacherIds && excludedTeacherIds.length > 0) {
      effectiveCandidates = effectiveCandidates.filter((t) => !excludedTeacherIds.includes(t.id));
    }

    // Quick check: no candidate teachers at all
    if (effectiveCandidates.length === 0) {
      const reason = req.forcedTeacherId
        ? "מחנך/ת הכיתה לא מוגדר/ת או לא זמין/ה לשיבוץ שעת מחנך"
        : "אין מורים מוגדרים למקצוע זה";
      unplaced.push({
        subjectName: req.subjectName,
        remaining: req.hoursPerWeek,
        reason,
      });
      continue;
    }

    let remaining = req.hoursPerWeek;

    for (let attempt = 0; attempt < req.hoursPerWeek; attempt++) {
      // Build candidate slots with scores
      const candidates: SlotScore[] = [];

      for (let day = 0; day < dayCount; day++) {
        const lastPeriod = input.dayLastPeriods?.[day] ?? periodCount - 1;
        for (let period = 0; period <= lastPeriod; period++) {
          if (isClassBooked(classId, day, period, slots)) continue;

          const score = scoreSlot(day, period, classId, slots);
          if (score >= 99999) continue; // would create gap — skip

          candidates.push({ day, period, score });
        }
      }

      // No free slots for this class at all
      if (candidates.length === 0) {
        unplaced.push({
          subjectName: req.subjectName,
          remaining: req.hoursPerWeek - attempt,
          reason: "כל חריצי הזמן תפוסים לכיתה",
        });
        break;
      }

      // Sort by score
      candidates.sort((a, b) => a.score - b.score);

      let placed_this = false;
      // Track the most specific failure reason encountered across all candidate slots
      let failPriority = 0;
      let failReason = "לא נמצא חריץ זמין";
      const bump = (priority: number, reason: string) => {
        if (priority > failPriority) { failPriority = priority; failReason = reason; }
      };

      for (const cand of candidates) {
        // No-consecutive check: skip if this subject already has an adjacent lesson today
        if (req.noConsecutive) {
          const placedSameSubjectToday = placed
            .filter((p) => p.subjectId === req.subjectId && p.day === cand.day)
            .map((p) => p.period);
          if (placedSameSubjectToday.some((p) => Math.abs(p - cand.period) <= 1)) {
            bump(3, "אילוץ אי-רציפות מונע השלמת השיבוץ");
            continue;
          }
        }

        // Find an available teacher
        let chosenTeacher: { id: string; name: string } | null = null;

        for (const teacher of effectiveCandidates) {
          // Check weekly hour cap
          const hoursUsed = teacherHoursUsed.get(teacher.id) ?? 0;
          if (teacher.maxHoursPerWeek != null && hoursUsed >= teacher.maxHoursPerWeek) {
            const msg = effectiveCandidates.length === 1
              ? `${teacher.name} הגיע/ה למכסת שעות שבועית (${teacher.maxHoursPerWeek} שע׳)`
              : "מורי המקצוע הגיעו למכסת שעות שבועית";
            bump(5, msg);
            continue;
          }
          if (isTeacherUnavailable(teacher.id, cand.day, cand.period, constraints)) {
            bump(2, "המורה חסום/ה לפי אילוצי זמינות");
            continue;
          }
          if (isTeacherBooked(teacher.id, cand.day, cand.period, slots)) {
            bump(1, "כל המורים תפוסים בשעות האפשריות");
            continue;
          }
          chosenTeacher = teacher;
          break;
        }

        if (!chosenTeacher) continue;

        // Find a room (optional — placed without room if none available)
        const room = findRoom(classStudentCount, cand.day, cand.period, slots, rooms, allowedRoomIds);

        // Commit the slot
        const newSlot: ExistingSlot = {
          day: cand.day,
          period: cand.period,
          classId,
          teacherId: chosenTeacher.id,
          roomId: room?.id ?? null,
        };
        slots.push(newSlot);

        // Increment teacher's used hours so subsequent placements respect the cap
        teacherHoursUsed.set(chosenTeacher.id, (teacherHoursUsed.get(chosenTeacher.id) ?? 0) + 1);

        placed.push({
          day: cand.day,
          period: cand.period,
          classId,
          teacherId: chosenTeacher.id,
          subjectId: req.subjectId,
          roomId: room?.id ?? null,
          studyGroupId: req.studyGroupId,
          subjectName: req.subjectName,
          subjectColor: req.subjectColor,
          teacherName: chosenTeacher.name,
          className,
          roomName: room?.name,
        });

        remaining--;
        placed_this = true;
        break;
      }

      if (!placed_this) {
        unplaced.push({
          subjectName: req.subjectName,
          remaining: req.hoursPerWeek - attempt,
          reason: failReason,
        });
        break;
      }
    }

    // If we couldn't place all hours, note it (shouldn't normally reach here, but as a safety net)
    if (remaining > 0) {
      const alreadyNoted = unplaced.find((u) => u.subjectName === req.subjectName);
      if (!alreadyNoted) {
        unplaced.push({
          subjectName: req.subjectName,
          remaining,
          reason: "לא נמצאו מספיק חריצים זמינים",
        });
      }
    }
  }

  return { placed, unplaced };
}

// ─── Grade-Level Scheduler ────────────────────────────────────────────────────
/**
 * Schedules a single subject for ALL classes in a grade simultaneously,
 * ensuring each class gets the lesson at the same (day, period) pair.
 * Each class has its own teacher (via study group). Teachers must be distinct.
 */

export interface GradeLevelAssignment {
  classId: string;
  className: string;
  studentCount: number;
  teacherId: string;
  teacherName: string;
  maxHoursPerWeek: number | null;
  studyGroupId: string | null;
  allowedRoomIds: string[] | null;
}

export interface GradeLevelInput {
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  hoursPerWeek: number;
  noConsecutive?: boolean;
  assignments: GradeLevelAssignment[];
  existingSlots: ExistingSlot[];
  rooms: RoomOption[];
  constraints: ConstraintEntry[];
  dayCount: number;
  periodCount: number;
  dayLastPeriods?: number[];
}

export function runGradeLevelScheduler(input: GradeLevelInput): SchedulerOutput {
  const {
    subjectId, subjectName, subjectColor,
    hoursPerWeek, noConsecutive,
    assignments, rooms, constraints,
    dayCount, periodCount,
  } = input;

  // Validate: same teacher must not appear in two different study groups
  const teacherToStudyGroup = new Map<string, string | null>();
  for (const a of assignments) {
    const existing = teacherToStudyGroup.get(a.teacherId);
    if (existing !== undefined) {
      const isSameGroup = a.studyGroupId !== null && a.studyGroupId === existing;
      if (!isSameGroup) {
        return {
          placed: [],
          unplaced: [{
            subjectName,
            remaining: hoursPerWeek,
            reason: "מורה מוגדר/ת ביותר מקבוצת לימוד אחת לאותו מקצוע — לא ניתן לשבץ",
          }],
        };
      }
    }
    teacherToStudyGroup.set(a.teacherId, a.studyGroupId ?? null);
  }

  const slots: ExistingSlot[] = [...input.existingSlots];
  const placed: SchedulerSlot[] = [];
  const unplaced: SchedulerOutput["unplaced"] = [];

  // Pre-count used hours per teacher; deduplicate study group slots (one session = one hour)
  const teacherHoursUsed = new Map<string, number>();
  const seenSgSlots = new Set<string>();
  for (const s of input.existingSlots) {
    if (s.studyGroupId) {
      const key = `${s.teacherId}:${s.studyGroupId}:${s.day}:${s.period}`;
      if (seenSgSlots.has(key)) continue;
      seenSgSlots.add(key);
    }
    teacherHoursUsed.set(s.teacherId, (teacherHoursUsed.get(s.teacherId) ?? 0) + 1);
  }

  for (let attempt = 0; attempt < hoursPerWeek; attempt++) {
    // Candidate slots where EVERY class AND EVERY teacher is free
    interface GradeSlotScore { day: number; period: number; score: number }
    const candidates: GradeSlotScore[] = [];

    for (let day = 0; day < dayCount; day++) {
      const lastPeriod = input.dayLastPeriods?.[day] ?? periodCount - 1;
      for (let period = 0; period <= lastPeriod; period++) {
        // 1. All classes must be free
        const allClassesFree = assignments.every(
          (a) => !isClassBooked(a.classId, day, period, slots)
        );
        if (!allClassesFree) continue;

        // 2. All teachers must be free and not unavailable
        const allTeachersFree = assignments.every((a) => {
          if (isTeacherUnavailable(a.teacherId, day, period, constraints)) return false;
          if (isTeacherBooked(a.teacherId, day, period, slots)) return false;
          const used = teacherHoursUsed.get(a.teacherId) ?? 0;
          if (a.maxHoursPerWeek != null && used >= a.maxHoursPerWeek) return false;
          return true;
        });
        if (!allTeachersFree) continue;

        // 3. No-consecutive check across all classes
        if (noConsecutive) {
          const hasConsecutive = assignments.some((a) => {
            const sameDayPlaced = placed
              .filter((p) => p.classId === a.classId && p.day === day)
              .map((p) => p.period);
            return sameDayPlaced.some((p) => Math.abs(p - period) <= 1);
          });
          if (hasConsecutive) continue;
        }

        // Score: average gap-avoidance score across classes
        const score =
          assignments.reduce((sum, a) => sum + scoreSlot(day, period, a.classId, slots), 0) /
          assignments.length;

        if (score >= 99999) continue;
        candidates.push({ day, period, score });
      }
    }

    if (candidates.length === 0) {
      unplaced.push({
        subjectName,
        remaining: hoursPerWeek - attempt,
        reason: "לא נמצאה שעה משותפת שבה כל כיתות השכבה פנויות",
      });
      break;
    }

    candidates.sort((a, b) => a.score - b.score);
    const best = candidates[0];

    // Place one slot per assignment at the chosen (day, period).
    // Classes in the same study group share a room and count as one teacher-hour.
    const sgStudentCount = new Map<string, number>();
    for (const a of assignments) {
      if (a.studyGroupId) {
        sgStudentCount.set(a.studyGroupId, (sgStudentCount.get(a.studyGroupId) ?? 0) + a.studentCount);
      }
    }
    const studyGroupRoomMap = new Map<string, RoomOption | null>();
    const incrementedTeachers = new Set<string>();

    for (const a of assignments) {
      let room: RoomOption | null;
      if (a.studyGroupId && studyGroupRoomMap.has(a.studyGroupId)) {
        room = studyGroupRoomMap.get(a.studyGroupId)!;
      } else {
        const count = a.studyGroupId ? (sgStudentCount.get(a.studyGroupId) ?? a.studentCount) : a.studentCount;
        room = findRoom(count, best.day, best.period, slots, rooms, a.allowedRoomIds);
        if (a.studyGroupId) studyGroupRoomMap.set(a.studyGroupId, room);
      }

      const newSlot: ExistingSlot = {
        day: best.day,
        period: best.period,
        classId: a.classId,
        teacherId: a.teacherId,
        roomId: room?.id ?? null,
        studyGroupId: a.studyGroupId,
      };
      slots.push(newSlot);

      const dedupeKey = a.studyGroupId ? `${a.teacherId}:${a.studyGroupId}` : a.teacherId;
      if (!incrementedTeachers.has(dedupeKey)) {
        incrementedTeachers.add(dedupeKey);
        teacherHoursUsed.set(a.teacherId, (teacherHoursUsed.get(a.teacherId) ?? 0) + 1);
      }

      placed.push({
        day: best.day,
        period: best.period,
        classId: a.classId,
        teacherId: a.teacherId,
        subjectId,
        roomId: room?.id ?? null,
        studyGroupId: a.studyGroupId,
        subjectName,
        subjectColor,
        teacherName: a.teacherName,
        className: a.className,
        roomName: room?.name,
      });
    }
  }

  return { placed, unplaced };
}
