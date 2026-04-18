"use server";

import { prisma } from "./prisma";
import { auth } from "./auth";

async function getSchoolId() {
  const session = await auth();
  const schoolId = (session?.user as Record<string, unknown>)?.schoolId as string;
  if (!schoolId) throw new Error("לא מחובר");
  return schoolId;
}

/** Teachers who are at ≥90% of their weekly hour cap. */
export async function getTeachersNearCap() {
  const schoolId = await getSchoolId();

  const teachers = await prisma.teacher.findMany({
    where: { schoolId, maxHoursPerWeek: { not: null } },
    select: { id: true, name: true, maxHoursPerWeek: true },
  });

  const slotsCount = await prisma.timetableSlot.groupBy({
    by: ["teacherId"],
    where: { class: { schoolId } },
    _count: { _all: true },
  });

  const countMap = new Map(slotsCount.map((r) => [r.teacherId, r._count._all]));

  return teachers
    .filter((t) => {
      const used = countMap.get(t.id) ?? 0;
      const cap = t.maxHoursPerWeek!;
      return used / cap >= 0.9;
    })
    .map((t) => ({
      teacherId: t.id,
      teacherName: t.name,
      used: countMap.get(t.id) ?? 0,
      cap: t.maxHoursPerWeek!,
    }));
}

/** Absence counts by status for the given ISO week string (YYYY-W##). */
export async function getAbsencesThisWeek(weekStart: string, weekEnd: string) {
  const schoolId = await getSchoolId();

  const absences = await prisma.absence.findMany({
    where: {
      teacher: { schoolId },
      date: { gte: weekStart, lte: weekEnd },
    },
    select: { status: true, reason: true },
  });

  const byStatus: Record<string, number> = {};
  const byReason: Record<string, number> = {};

  for (const a of absences) {
    byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
    byReason[a.reason] = (byReason[a.reason] ?? 0) + 1;
  }

  const total = absences.length;
  const resolved = byStatus["RESOLVED"] ?? 0;
  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

  // Top 3 reasons
  const topReasons = Object.entries(byReason)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([reason, count]) => ({ reason, count }));

  return { total, byStatus, resolutionRate, topReasons };
}

/** Room utilization: slot occupancy per room as a fraction of (dayCount × periodCount). */
export async function getRoomUtilization() {
  const schoolId = await getSchoolId();

  const school = await prisma.school.findFirst({
    where: { id: schoolId },
    select: { dayCount: true, periodCount: true },
  });

  const totalSlots = (school?.dayCount ?? 6) * (school?.periodCount ?? 9);

  const rooms = await prisma.room.findMany({
    where: { schoolId },
    select: {
      id: true,
      name: true,
      _count: { select: { slots: true } },
    },
    orderBy: { name: "asc" },
  });

  return rooms
    .map((r) => ({
      roomId: r.id,
      roomName: r.name,
      slotCount: r._count.slots,
      utilization: totalSlots > 0 ? r._count.slots / totalSlots : 0,
    }))
    .sort((a, b) => b.utilization - a.utilization);
}

/** Top substitute teachers in the last N days. */
export async function getSubstitutionLeaders(sinceDaysAgo = 14) {
  const schoolId = await getSchoolId();

  const since = new Date();
  since.setDate(since.getDate() - sinceDaysAgo);
  const sinceStr = since.toISOString().slice(0, 10);

  const subs = await prisma.substitution.findMany({
    where: {
      absence: { teacher: { schoolId }, date: { gte: sinceStr } },
      substituteTeacherId: { not: null },
    },
    select: {
      substituteTeacherId: true,
      substituteTeacher: { select: { name: true } },
    },
  });

  const counts = new Map<string, { name: string; count: number }>();
  for (const s of subs) {
    if (!s.substituteTeacherId || !s.substituteTeacher) continue;
    const entry = counts.get(s.substituteTeacherId) ?? { name: s.substituteTeacher.name, count: 0 };
    entry.count++;
    counts.set(s.substituteTeacherId, entry);
  }

  return [...counts.entries()]
    .map(([id, v]) => ({ teacherId: id, teacherName: v.name, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

/**
 * Detect absence patterns: teachers who have ≥50% of their recent absences
 * on the same day-of-week or same period.
 */
export async function getTeacherAbsencePatterns(sinceDaysAgo = 30) {
  const schoolId = await getSchoolId();

  const since = new Date();
  since.setDate(since.getDate() - sinceDaysAgo);
  const sinceStr = since.toISOString().slice(0, 10);

  const absences = await prisma.absence.findMany({
    where: { teacher: { schoolId }, date: { gte: sinceStr } },
    select: {
      teacherId: true,
      teacher: { select: { name: true } },
      date: true,
    },
  });

  // Group by teacher
  const byTeacher = new Map<string, { name: string; dates: string[] }>();
  for (const a of absences) {
    const entry = byTeacher.get(a.teacherId) ?? { name: a.teacher.name, dates: [] };
    entry.dates.push(a.date);
    byTeacher.set(a.teacherId, entry);
  }

  const patterns: {
    teacherName: string;
    dimension: "day";
    bucket: number; // 0=Sun…5=Fri
    share: number;
  }[] = [];

  for (const [, { name, dates }] of byTeacher) {
    if (dates.length < 3) continue; // need at least 3 absences to flag a pattern

    // day-of-week distribution (0=Sun…6=Sat)
    const dayCounts: Record<number, number> = {};
    for (const d of dates) {
      const dow = new Date(d).getDay();
      dayCounts[dow] = (dayCounts[dow] ?? 0) + 1;
    }

    for (const [dow, count] of Object.entries(dayCounts)) {
      const share = count / dates.length;
      if (share >= 0.5) {
        patterns.push({
          teacherName: name,
          dimension: "day",
          bucket: Number(dow),
          share,
        });
      }
    }
  }

  return patterns;
}

/** Consolidated insights for the dashboard — one call. */
export async function getDashboardInsights(weekStart: string, weekEnd: string) {
  const [absencesWeek, roomUtil, subLeaders, patterns] = await Promise.all([
    getAbsencesThisWeek(weekStart, weekEnd),
    getRoomUtilization(),
    getSubstitutionLeaders(14),
    getTeacherAbsencePatterns(30),
  ]);

  return { absencesWeek, roomUtil, subLeaders, patterns };
}
