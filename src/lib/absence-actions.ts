"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function getSchoolId() {
  const session = await auth();
  const schoolId = (session?.user as Record<string, unknown>)?.schoolId as string;
  if (!schoolId) throw new Error("Unauthorized");
  return schoolId;
}

export async function createAbsence(data: {
  teacherId: string;
  date: string; // YYYY-MM-DD
  periods: number[];
  reason: string;
  note?: string;
}) {
  const schoolId = await getSchoolId();

  const teacher = await prisma.teacher.findFirst({
    where: { id: data.teacherId, schoolId },
  });
  if (!teacher) throw new Error("Teacher not found");

  const absence = await prisma.absence.upsert({
    where: { teacherId_date: { teacherId: data.teacherId, date: data.date } },
    update: {
      periods: JSON.stringify(data.periods),
      reason: data.reason,
      note: data.note,
      status: "UNRESOLVED",
    },
    create: {
      teacherId: data.teacherId,
      date: data.date,
      periods: JSON.stringify(data.periods),
      reason: data.reason,
      note: data.note,
    },
  });

  // Auto-resolve: if teacher has no actual timetable slots on this date+periods, mark NOT_REQUIRED
  const dayOfWeek = new Date(data.date + "T12:00:00").getDay();
  const teachableCount = await prisma.timetableSlot.count({
    where: { teacherId: data.teacherId, day: dayOfWeek, period: { in: data.periods } },
  });
  if (teachableCount === 0) {
    await prisma.absence.update({
      where: { id: absence.id },
      data: { status: "NOT_REQUIRED" },
    });
  }

  revalidatePath("/absences");
  return absence;
}

export async function deleteAbsence(id: string) {
  const schoolId = await getSchoolId();
  const absence = await prisma.absence.findFirst({
    where: { id, teacher: { schoolId } },
  });
  if (!absence) throw new Error("Not found");

  await prisma.absence.delete({ where: { id } });
  revalidatePath("/absences");
}

export async function loadAbsences(dateFilter?: string) {
  const schoolId = await getSchoolId();
  const where = dateFilter
    ? { teacher: { schoolId }, date: dateFilter, status: { not: "NOT_REQUIRED" } }
    : { teacher: { schoolId }, status: { not: "NOT_REQUIRED" } };

  const absences = await prisma.absence.findMany({
    where,
    include: {
      teacher: { select: { id: true, name: true } },
      substitutions: { select: { id: true, period: true, solutionType: true } },
    },
    orderBy: [{ date: "desc" }, { teacher: { name: "asc" } }],
  });

  // Enrich each absence with the periods that have actual timetable slots
  const enriched = await Promise.all(absences.map(async (absence) => {
    const periods: number[] = JSON.parse(absence.periods);
    const dayOfWeek = new Date(absence.date + "T12:00:00").getDay();
    const slots = await prisma.timetableSlot.findMany({
      where: { teacherId: absence.teacherId, day: dayOfWeek, period: { in: periods } },
      select: { period: true },
    });
    const teachablePeriods = slots.map(s => s.period);
    return { ...absence, teachablePeriods };
  }));

  return enriched;
}

export async function getAbsenceWithDetails(absenceId: string) {
  const schoolId = await getSchoolId();

  const absence = await prisma.absence.findFirst({
    where: { id: absenceId, teacher: { schoolId } },
    include: {
      teacher: { select: { id: true, name: true } },
      substitutions: true,
    },
  });
  if (!absence) throw new Error("Absence not found");

  // Parse the date to get day of week (0=Sun, 1=Mon... 5=Fri)
  const dateObj = new Date(absence.date);
  // In Israel: 0=Sun=day 0, 1=Mon=day 1, ..., 5=Fri=day 5
  const dayOfWeek = dateObj.getDay(); // 0=Sunday

  const periods: number[] = JSON.parse(absence.periods);

  // Find affected timetable slots
  const affectedSlots = await prisma.timetableSlot.findMany({
    where: {
      teacherId: absence.teacherId,
      day: dayOfWeek,
      period: { in: periods },
    },
    include: {
      class: { select: { id: true, name: true, grade: true } },
      subject: { select: { id: true, name: true, color: true } },
      room: { select: { id: true, name: true } },
    },
  });

  return { absence, affectedSlots, dayOfWeek };
}
