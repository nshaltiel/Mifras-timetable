import type { SlotData, TeacherConstraintData } from "./conflict-detector";

/**
 * Returns which periods a teacher is FREE on a given day.
 * Free = no existing slot AND no UNAVAILABLE constraint.
 */
export function getTeacherFreePeriodsOnDay(
  teacherId: string,
  day: number,
  periodCount: number,
  existingSlots: SlotData[],
  constraints: TeacherConstraintData[]
): number[] {
  const busyPeriods = new Set<number>();

  for (const slot of existingSlots) {
    if (slot.teacherId === teacherId && slot.day === day) {
      busyPeriods.add(slot.period);
    }
  }

  for (const c of constraints) {
    if (c.teacherId !== teacherId) continue;
    if (c.type !== "UNAVAILABLE") continue;
    if (c.day != null && c.day !== day) continue;
    if (c.period != null) {
      busyPeriods.add(c.period);
    } else {
      // All periods unavailable on this day
      for (let p = 0; p < periodCount; p++) busyPeriods.add(p);
    }
  }

  return Array.from({ length: periodCount }, (_, i) => i).filter(
    (p) => !busyPeriods.has(p)
  );
}

/**
 * Check if a specific teacher is free at a given day+period.
 */
export function isTeacherFree(
  teacherId: string,
  day: number,
  period: number,
  existingSlots: SlotData[],
  constraints: TeacherConstraintData[]
): boolean {
  return getTeacherFreePeriodsOnDay(
    teacherId,
    day,
    period + 1,
    existingSlots.filter((s) => s.period <= period),
    constraints
  ).includes(period);
}
