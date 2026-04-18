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
  candidateTeachers: { id: string; name: string }[];
  studyGroupId: string | null;
  /** If true, this subject must not be placed adjacent to another lesson of itself on the same day. */
  noConsecutive?: boolean;
}

export interface ExistingSlot {
  day: number;
  period: number;
  classId: string;
  teacherId: string;
  roomId?: string | null;
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
 */
function findRoom(
  studentCount: number,
  day: number,
  period: number,
  slots: ExistingSlot[],
  rooms: RoomOption[]
): RoomOption | null {
  const candidates = rooms.filter(
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
  const { classId, className, classStudentCount, requirements, dayCount, periodCount, rooms, constraints } = input;

  // Working copy of slots — we append as we place
  const slots: ExistingSlot[] = [...input.existingSlots];

  const placed: SchedulerSlot[] = [];
  const unplaced: SchedulerOutput["unplaced"] = [];

  for (const req of requirements) {
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

      // Sort by score
      candidates.sort((a, b) => a.score - b.score);

      let placed_this = false;

      for (const cand of candidates) {
        // No-consecutive check: skip if this subject already has an adjacent lesson today
        if (req.noConsecutive) {
          const placedSameSubjectToday = placed
            .filter((p) => p.subjectId === req.subjectId && p.day === cand.day)
            .map((p) => p.period);
          if (placedSameSubjectToday.some((p) => Math.abs(p - cand.period) <= 1)) continue;
        }

        // Find a teacher
        let chosenTeacher: { id: string; name: string } | null = null;
        for (const teacher of req.candidateTeachers) {
          if (isTeacherUnavailable(teacher.id, cand.day, cand.period, constraints)) continue;
          if (isTeacherBooked(teacher.id, cand.day, cand.period, slots)) continue;
          chosenTeacher = teacher;
          break;
        }
        if (!chosenTeacher) continue;

        // Find a room
        const room = findRoom(classStudentCount, cand.day, cand.period, slots, rooms);

        // Add slot
        const newSlot: ExistingSlot = {
          day: cand.day,
          period: cand.period,
          classId,
          teacherId: chosenTeacher.id,
          roomId: room?.id ?? null,
        };
        slots.push(newSlot);

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
        // Could not place this lesson
        unplaced.push({
          subjectName: req.subjectName,
          remaining: req.hoursPerWeek - attempt,
          reason: "לא נמצא חריץ זמין (מורה / חדר / חלון)",
        });
        break;
      }
    }

    // If we couldn't place all hours, note it
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
