"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { auth } from "./auth";
import type { TimetableSlot } from "@/stores/timetable-store";
import { detectConflicts } from "@/engine/conflict-detector";

async function getSchoolId() {
  const session = await auth();
  const schoolId = (session?.user as Record<string, unknown>)?.schoolId as string;
  if (!schoolId) throw new Error("לא מחובר");
  return schoolId;
}

export async function loadTimetableData(classId?: string) {
  const schoolId = await getSchoolId();

  const [slots, teachers, classes, subjects, rooms, constraints, studyGroups] =
    await Promise.all([
      prisma.timetableSlot.findMany({
        where: classId
          ? { classId, class: { schoolId } }
          : { class: { schoolId } },
        include: {
          teacher: true,
          class: true,
          subject: true,
          room: true,
        },
      }),
      prisma.teacher.findMany({
        where: { schoolId },
        include: { subjects: { include: { subject: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.class.findMany({
        where: { schoolId },
        orderBy: [{ grade: "asc" }, { name: "asc" }],
      }),
      prisma.subject.findMany({
        where: { schoolId },
        orderBy: { name: "asc" },
      }),
      prisma.room.findMany({
        where: { schoolId },
        orderBy: { name: "asc" },
      }),
      prisma.teacherConstraint.findMany({
        where: { teacher: { schoolId } },
      }),
      prisma.studyGroup.findMany({
        where: { subject: { schoolId } },
        include: {
          classes: { select: { classId: true } },
          teacher: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true, color: true } },
        },
      }),
    ]);

  return {
    slots: slots.map((s) => ({
      id: s.id,
      day: s.day,
      period: s.period,
      classId: s.classId,
      teacherId: s.teacherId,
      subjectId: s.subjectId,
      roomId: s.roomId,
      studyGroupId: s.studyGroupId,
      subjectName: s.subject.name,
      subjectColor: s.subject.color ?? "#4d90fe",
      teacherName: s.teacher.name,
      className: s.class.name,
      roomName: s.room?.name,
    })),
    teachers,
    classes,
    subjects,
    rooms,
    constraints,
    studyGroups,
  };
}

export async function saveSlot(slot: Omit<TimetableSlot, "subjectName" | "subjectColor" | "teacherName" | "className" | "roomName">) {
  const schoolId = await getSchoolId();

  // Verify class belongs to school
  const cls = await prisma.class.findFirst({ where: { id: slot.classId, schoolId } });
  if (!cls) throw new Error("כיתה לא נמצאה");

  // Get all other slots for conflict check (server-side validation)
  const existingSlots = await prisma.timetableSlot.findMany({
    where: { class: { schoolId } },
    select: { id: true, day: true, period: true, classId: true, teacherId: true, subjectId: true, roomId: true },
  });

  const conflicts = detectConflicts(
    slot,
    existingSlots.filter((s) => s.id !== slot.id),
    await prisma.teacherConstraint
      .findMany({ where: { teacher: { schoolId } } })
      .then((cs) => cs.map((c) => ({ ...c, day: c.day ?? undefined, period: c.period ?? undefined })))
  );

  if (conflicts.length > 0) {
    return { success: false, conflicts };
  }

  if (slot.id) {
    await prisma.timetableSlot.update({
      where: { id: slot.id },
      data: {
        day: slot.day,
        period: slot.period,
        classId: slot.classId,
        teacherId: slot.teacherId,
        subjectId: slot.subjectId,
        roomId: slot.roomId,
      },
    });
  } else {
    await prisma.timetableSlot.upsert({
      where: {
        day_period_classId: { day: slot.day, period: slot.period, classId: slot.classId },
      },
      create: {
        day: slot.day,
        period: slot.period,
        classId: slot.classId,
        teacherId: slot.teacherId,
        subjectId: slot.subjectId,
        roomId: slot.roomId ?? null,
      },
      update: {
        teacherId: slot.teacherId,
        subjectId: slot.subjectId,
        roomId: slot.roomId ?? null,
      },
    });
  }

  revalidatePath("/timetable");
  return { success: true, conflicts: [] };
}

export async function deleteSlot(day: number, period: number, classId: string) {
  const schoolId = await getSchoolId();

  await prisma.timetableSlot.deleteMany({
    where: { day, period, classId, class: { schoolId } },
  });

  revalidatePath("/timetable");
}

export async function loadSubstitutionsForDate(date: string) {
  const schoolId = await getSchoolId();
  const dateObj = new Date(date + "T12:00:00");
  const dayOfWeek = dateObj.getDay();

  const absences = await prisma.absence.findMany({
    where: { date, teacher: { schoolId } },
    include: {
      teacher: { select: { id: true, name: true } },
      substitutions: {
        include: {
          substituteTeacher: { select: { id: true, name: true } },
        },
      },
    },
  });

  type SubstitutionOverlay = {
    day: number;
    period: number;
    classId: string;
    solutionType: string;
    substituteTeacherName?: string;
    originalTeacherName: string;
  };

  const overlays: SubstitutionOverlay[] = [];

  for (const absence of absences) {
    const absentPeriods: number[] = JSON.parse(absence.periods);
    // Get affected slots for this teacher on this day
    const affectedSlots = await prisma.timetableSlot.findMany({
      where: { teacherId: absence.teacherId, day: dayOfWeek, period: { in: absentPeriods } },
      select: { classId: true, period: true },
    });

    for (const sub of absence.substitutions) {
      const slot = affectedSlots.find((s) => s.period === sub.period);
      if (!slot) continue;

      overlays.push({
        day: dayOfWeek,
        period: sub.period,
        classId: slot.classId,
        solutionType: sub.solutionType,
        substituteTeacherName: sub.substituteTeacher?.name,
        originalTeacherName: absence.teacher.name,
      });

      // For TIME_SWAP: also mark the swapped-to period
      if (sub.solutionType === "TIME_SWAP" && sub.swapDetails) {
        try {
          const swap = JSON.parse(sub.swapDetails) as {
            swapPeriod?: number;
            swapTeacherName?: string;
          };
          if (swap.swapPeriod != null) {
            overlays.push({
              day: dayOfWeek,
              period: swap.swapPeriod,
              classId: slot.classId,
              solutionType: "TIME_SWAP",
              substituteTeacherName: absence.teacher.name, // absent teacher's class moves here
              originalTeacherName: swap.swapTeacherName ?? "",
            });
          }
        } catch {
          // ignore bad JSON
        }
      }
    }
  }

  return overlays;
}

export async function saveTimetableBulk(slots: Array<Omit<TimetableSlot, "subjectName" | "subjectColor" | "teacherName" | "className" | "roomName">>) {
  const schoolId = await getSchoolId();

  // Delete all existing slots for the relevant classes
  const classIds = [...new Set(slots.map((s) => s.classId))];
  await prisma.timetableSlot.deleteMany({
    where: { classId: { in: classIds }, class: { schoolId } },
  });

  // Insert all new slots
  if (slots.length > 0) {
    await prisma.timetableSlot.createMany({
      data: slots.map((s) => ({
        day: s.day,
        period: s.period,
        classId: s.classId,
        teacherId: s.teacherId,
        subjectId: s.subjectId,
        roomId: s.roomId ?? null,
      })),
    });
  }

  revalidatePath("/timetable");
  return { success: true };
}
