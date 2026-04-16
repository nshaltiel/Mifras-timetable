"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { generateSuggestions, type SlotInfo, type TeacherInfo } from "@/engine/substitution-solver";

async function getSchoolId() {
  const session = await auth();
  const schoolId = (session?.user as Record<string, unknown>)?.schoolId as string;
  if (!schoolId) throw new Error("Unauthorized");
  return schoolId;
}

export async function getSubstitutionPageData(absenceId: string) {
  const schoolId = await getSchoolId();

  const absence = await prisma.absence.findFirst({
    where: { id: absenceId, teacher: { schoolId } },
    include: {
      teacher: { select: { id: true, name: true } },
      substitutions: true,
    },
  });
  if (!absence) throw new Error("Absence not found");

  const dateObj = new Date(absence.date + "T12:00:00");
  const dayOfWeek = dateObj.getDay(); // 0=Sun
  const periods: number[] = JSON.parse(absence.periods);

  // All slots for this day for this school
  const daySlots = await prisma.timetableSlot.findMany({
    where: { day: dayOfWeek, class: { schoolId } },
    include: {
      class: { select: { id: true, name: true, grade: true, homeroomTeacherId: true } },
      teacher: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true, color: true } },
      room: { select: { id: true, name: true } },
    },
  });

  // All teachers (with phone and gender for WhatsApp)
  const teachers = await prisma.teacher.findMany({
    where: { schoolId },
    include: {
      subjects: { select: { subjectId: true } },
      homeroomClass: { select: { id: true } },
    },
  });

  // Teacher details map (phone, gender) for WhatsApp
  const teacherDetails: Record<string, { phone: string | null; gender: string }> = {};
  for (const t of teachers) {
    teacherDetails[t.id] = { phone: t.phone, gender: t.gender };
  }

  // School period times
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { periodTimes: true } });
  const periodTimes: { start: string; end: string }[] = school?.periodTimes ? JSON.parse(school.periodTimes) : [];

  // Other absences today
  const otherAbsences = await prisma.absence.findMany({
    where: { date: absence.date, id: { not: absenceId } },
    select: { teacherId: true },
  });
  const absentTeacherIds = otherAbsences.map((a) => a.teacherId);

  // Teacher constraints
  const constraints = await prisma.teacherConstraint.findMany({
    where: { teacher: { schoolId } },
  });

  // Map slots to SlotInfo
  const slotInfos: SlotInfo[] = daySlots.map((s) => ({
    id: s.id,
    day: s.day,
    period: s.period,
    classId: s.classId,
    className: s.class.name,
    classGrade: s.class.grade,
    teacherId: s.teacher.id,
    teacherName: s.teacher.name,
    subjectId: s.subjectId,
    subjectName: s.subject.name,
    roomId: s.roomId,
    roomName: s.room?.name ?? null,
    studyGroupId: s.studyGroupId,
  }));

  // Map teachers to TeacherInfo
  const teacherInfos: TeacherInfo[] = teachers.map((t) => ({
    id: t.id,
    name: t.name,
    subjectIds: t.subjects.map((ts) => ts.subjectId),
    homeroomClassIds: t.homeroomClass ? [t.homeroomClass.id] : [],
    maxHoursPerWeek: t.maxHoursPerWeek ?? 30,
  }));

  // For each affected period, generate suggestions — skip free periods (no lesson)
  const affectedSlots = slotInfos.filter(
    (s) => s.teacherId === absence.teacherId && periods.includes(s.period)
  );

  const periodSuggestions: {
    period: number;
    slot: SlotInfo | null;
    suggestions: ReturnType<typeof generateSuggestions>;
    existingSubstitution: (typeof absence.substitutions)[0] | null;
  }[] = periods
    .map((p) => {
      const slot = affectedSlots.find((s) => s.period === p) ?? null;
      const existing = absence.substitutions.find((sub) => sub.period === p) ?? null;

      let suggestions: ReturnType<typeof generateSuggestions> = [];
      if (slot) {
        suggestions = generateSuggestions({
          absenceTeacherId: absence.teacherId,
          date: absence.date,
          day: dayOfWeek,
          period: p,
          affectedSlot: slot,
          allSlots: slotInfos,
          allTeachers: teacherInfos,
          teacherAbsences: absentTeacherIds,
          teacherConstraints: constraints.map((c) => ({
            teacherId: c.teacherId,
            type: c.type,
            day: c.day,
            period: c.period,
          })),
        });
      }

      return { period: p, slot, suggestions, existingSubstitution: existing };
    })
    .filter((pd) => pd.slot !== null); // Only show periods with actual lessons

  return { absence, periodSuggestions, dayOfWeek, teacherDetails, periodTimes };
}

export async function applySubstitution(data: {
  absenceId: string;
  period: number;
  solutionType: string;
  substituteTeacherId?: string;
  mergedWithClassId?: string;
  swapDetails?: string;
  notes?: string;
}) {
  const schoolId = await getSchoolId();
  const absence = await prisma.absence.findFirst({
    where: { id: data.absenceId, teacher: { schoolId } },
    include: { substitutions: true },
  });
  if (!absence) throw new Error("Absence not found");

  // Upsert substitution for this period
  const existing = absence.substitutions.find((s) => s.period === data.period);
  if (existing) {
    await prisma.substitution.update({
      where: { id: existing.id },
      data: {
        solutionType: data.solutionType,
        substituteTeacherId: data.substituteTeacherId ?? null,
        mergedWithClassId: data.mergedWithClassId ?? null,
        swapDetails: data.swapDetails ?? null,
        notes: data.notes ?? null,
      },
    });
  } else {
    await prisma.substitution.create({
      data: {
        absenceId: data.absenceId,
        period: data.period,
        solutionType: data.solutionType,
        substituteTeacherId: data.substituteTeacherId ?? null,
        mergedWithClassId: data.mergedWithClassId ?? null,
        swapDetails: data.swapDetails ?? null,
        notes: data.notes ?? null,
      },
    });
  }

  // Update absence status — only count periods where teacher has an actual lesson
  const periods: number[] = JSON.parse(absence.periods);
  const dateObj = new Date(absence.date + "T12:00:00");
  const dayOfWeek = dateObj.getDay();
  const teachablePeriodCount = await prisma.timetableSlot.count({
    where: { teacherId: absence.teacherId, day: dayOfWeek, period: { in: periods } },
  });
  const resolvedCount = await prisma.substitution.count({ where: { absenceId: data.absenceId } });
  const effectiveTotal = teachablePeriodCount > 0 ? teachablePeriodCount : periods.length;
  const newStatus =
    resolvedCount >= effectiveTotal ? "RESOLVED" : "PARTIALLY_RESOLVED";
  await prisma.absence.update({
    where: { id: data.absenceId },
    data: { status: newStatus },
  });

  revalidatePath(`/substitutions/${data.absenceId}`);
  revalidatePath("/absences");
}

export async function removeSubstitution(absenceId: string, period: number) {
  const schoolId = await getSchoolId();
  const absence = await prisma.absence.findFirst({
    where: { id: absenceId, teacher: { schoolId } },
    include: { substitutions: true },
  });
  if (!absence) throw new Error("Not found");

  const sub = absence.substitutions.find((s) => s.period === period);
  if (sub) await prisma.substitution.delete({ where: { id: sub.id } });

  const remaining = await prisma.substitution.count({ where: { absenceId } });
  const newStatus = remaining === 0 ? "UNRESOLVED" : "PARTIALLY_RESOLVED";
  await prisma.absence.update({ where: { id: absenceId }, data: { status: newStatus } });

  revalidatePath(`/substitutions/${absenceId}`);
  revalidatePath("/absences");
}
