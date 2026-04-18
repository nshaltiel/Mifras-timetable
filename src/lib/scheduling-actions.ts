"use server";

import { prisma } from "./prisma";
import { auth } from "./auth";
import { revalidatePath } from "next/cache";
import { runAutoScheduler, type SchedulerOutput } from "@/engine/auto-scheduler";

async function getSchoolId() {
  const session = await auth();
  const schoolId = (session?.user as Record<string, unknown>)?.schoolId as string;
  if (!schoolId) throw new Error("לא מחובר");
  return schoolId;
}

// ─── Requirements CRUD ────────────────────────────────────────────────────────

export async function getClassRequirements(classId: string) {
  const schoolId = await getSchoolId();
  // Verify class belongs to school
  const cls = await prisma.class.findFirst({ where: { id: classId, schoolId } });
  if (!cls) throw new Error("כיתה לא נמצאה");

  return prisma.classSubjectRequirement.findMany({
    where: { classId },
    include: { subject: { select: { id: true, name: true, color: true } } },
  });
}

export async function saveClassRequirements(
  classId: string,
  requirements: { subjectId: string; hoursPerWeek: number }[]
) {
  const schoolId = await getSchoolId();
  const cls = await prisma.class.findFirst({ where: { id: classId, schoolId } });
  if (!cls) throw new Error("כיתה לא נמצאה");

  // Upsert each requirement; remove ones with 0 hours
  await prisma.$transaction([
    // Delete all existing
    prisma.classSubjectRequirement.deleteMany({ where: { classId } }),
    // Insert new ones (only non-zero)
    ...requirements
      .filter((r) => r.hoursPerWeek > 0)
      .map((r) =>
        prisma.classSubjectRequirement.create({
          data: { classId, subjectId: r.subjectId, hoursPerWeek: r.hoursPerWeek },
        })
      ),
  ]);

  revalidatePath("/timetable");
}

// ─── Auto-schedule a class ────────────────────────────────────────────────────

export async function autoScheduleClass(classId: string): Promise<{
  output: SchedulerOutput;
  placed: {
    day: number; period: number; classId: string; teacherId: string;
    subjectId: string; roomId: string | null; studyGroupId: string | null;
    subjectName: string; subjectColor: string; teacherName: string;
    className: string; roomName?: string;
  }[];
}> {
  const schoolId = await getSchoolId();

  const [cls, requirements, existingSlots, teachers, rooms, constraints, studyGroups, school] =
    await Promise.all([
      prisma.class.findFirst({ where: { id: classId, schoolId } }),
      prisma.classSubjectRequirement.findMany({
        where: { classId },
        include: { subject: true },
      }),
      prisma.timetableSlot.findMany({
        where: { class: { schoolId } },
        select: { day: true, period: true, classId: true, teacherId: true, roomId: true },
      }),
      prisma.teacher.findMany({
        where: { schoolId },
        include: { subjects: { select: { subjectId: true } } },
      }),
      prisma.room.findMany({ where: { schoolId } }),
      prisma.teacherConstraint.findMany({ where: { teacher: { schoolId } } }),
      prisma.studyGroup.findMany({
        where: { subject: { schoolId } },
        include: { classes: { select: { classId: true } } },
      }),
      prisma.school.findFirst({ where: { id: schoolId } }),
    ]);

  if (!cls) throw new Error("כיתה לא נמצאה");

  const dayCount = school?.dayCount ?? 6;
  const periodCount = school?.periodCount ?? 9;

  // Build requirements with teacher candidates
  const reqList = requirements.map((req) => {
    // Find study group for this class+subject (gives preferred teacher)
    const sg = studyGroups.find(
      (g) => g.subjectId === req.subjectId && g.classes.some((c) => c.classId === classId)
    );

    // All teachers who teach this subject
    const subjectTeachers = teachers
      .filter((t) => t.subjects.some((ts) => ts.subjectId === req.subjectId))
      .map((t) => ({ id: t.id, name: t.name }));

    // Put study-group teacher first if available
    let candidateTeachers = subjectTeachers;
    if (sg) {
      const preferred = subjectTeachers.find((t) => t.id === sg.teacherId);
      if (preferred) {
        candidateTeachers = [preferred, ...subjectTeachers.filter((t) => t.id !== preferred.id)];
      }
    }

    return {
      subjectId: req.subjectId,
      subjectName: req.subject.name,
      subjectColor: req.subject.color ?? "#4d90fe",
      hoursPerWeek: req.hoursPerWeek,
      candidateTeachers,
      studyGroupId: sg?.id ?? null,
    };
  });

  const output = runAutoScheduler({
    classId,
    className: cls.name,
    classStudentCount: cls.studentCount,
    requirements: reqList,
    existingSlots: existingSlots.map((s) => ({
      day: s.day,
      period: s.period,
      classId: s.classId,
      teacherId: s.teacherId,
      roomId: s.roomId,
    })),
    rooms: rooms.map((r) => ({
      id: r.id,
      name: r.name,
      capacity: r.capacity,
      maxConcurrentClasses: r.maxConcurrentClasses,
    })),
    constraints: constraints.map((c) => ({
      teacherId: c.teacherId,
      type: c.type,
      day: c.day,
      period: c.period,
    })),
    dayCount,
    periodCount,
  });

  return { output, placed: output.placed };
}

// ─── Commit auto-scheduled slots to DB ───────────────────────────────────────

export async function commitAutoScheduledSlots(
  classId: string,
  slots: {
    day: number; period: number; classId: string; teacherId: string;
    subjectId: string; roomId: string | null; studyGroupId: string | null;
  }[]
) {
  const schoolId = await getSchoolId();
  const cls = await prisma.class.findFirst({ where: { id: classId, schoolId } });
  if (!cls) throw new Error("כיתה לא נמצאה");

  // Remove existing slots for this class
  await prisma.timetableSlot.deleteMany({ where: { classId, class: { schoolId } } });

  if (slots.length > 0) {
    await prisma.timetableSlot.createMany({
      data: slots.map((s) => ({
        day: s.day,
        period: s.period,
        classId: s.classId,
        teacherId: s.teacherId,
        subjectId: s.subjectId,
        roomId: s.roomId ?? null,
        studyGroupId: s.studyGroupId ?? null,
      })),
    });
  }

  revalidatePath("/timetable");
  return { success: true };
}
