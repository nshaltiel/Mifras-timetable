"use server";

import { prisma } from "./prisma";
import { auth } from "./auth";
import { revalidatePath } from "next/cache";
import {
  runAutoScheduler,
  runGradeLevelScheduler,
  type SchedulerOutput,
  type GradeLevelAssignment,
} from "@/engine/auto-scheduler";

async function getSchoolId() {
  const session = await auth();
  const schoolId = (session?.user as Record<string, unknown>)?.schoolId as string;
  if (!schoolId) throw new Error("לא מחובר");
  return schoolId;
}

// ─── Requirements CRUD ────────────────────────────────────────────────────────

export async function getClassRequirements(classId: string) {
  const schoolId = await getSchoolId();
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

  await prisma.$transaction([
    prisma.classSubjectRequirement.deleteMany({ where: { classId } }),
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

export async function autoScheduleClass(
  classId: string,
  options?: {
    dayLastPeriods?: number[];
    noConsecutiveSubjectIds?: string[];
    /** Subject IDs to hand off to grade-level scheduler instead of per-class. */
    gradeLevelSubjectIds?: string[];
  }
): Promise<{
  output: SchedulerOutput;
  placed: {
    day: number; period: number; classId: string; teacherId: string;
    subjectId: string; roomId: string | null; studyGroupId: string | null;
    subjectName: string; subjectColor: string; teacherName: string;
    className: string; roomName?: string;
  }[];
}> {
  const schoolId = await getSchoolId();

  const [cls, requirements, existingSlots, teachers, rooms, constraints, studyGroups, school, excludedRows] =
    await Promise.all([
      prisma.class.findFirst({
        where: { id: classId, schoolId },
        include: {
          layer: { include: { allowedRooms: { select: { roomId: true } } } },
        },
      }),
      prisma.classSubjectRequirement.findMany({
        where: { classId },
        include: { subject: true },
      }),
      prisma.timetableSlot.findMany({
        where: { class: { schoolId } },
        select: { day: true, period: true, classId: true, teacherId: true, roomId: true, studyGroupId: true },
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
      prisma.teacherExcludedClass.findMany({ where: { classId } }),
    ]);

  if (!cls) throw new Error("כיתה לא נמצאה");

  const dayCount = school?.dayCount ?? 6;
  const periodCount = school?.periodCount ?? 9;

  // Allowed rooms: from the class's layer, or null = all rooms
  const allowedRoomIds =
    cls.layer && cls.layer.allowedRooms.length > 0
      ? cls.layer.allowedRooms.map((lr) => lr.roomId)
      : null;

  // Teachers excluded from this class
  const excludedTeacherIds = excludedRows.map((r) => r.teacherId);

  // Filter out grade-level subjects
  const gradeLevelSubjectIds = new Set(options?.gradeLevelSubjectIds ?? []);
  const perClassRequirements = requirements.filter(
    (r) => !gradeLevelSubjectIds.has(r.subjectId)
  );

  // Build requirements with teacher candidates
  const reqList = perClassRequirements.map((req) => {
    const isHomeroom = req.subject.category === "homeroom";
    const homeroomTeacherId = isHomeroom ? cls.homeroomTeacherId : null;

    const sg = studyGroups.find(
      (g) => g.subjectId === req.subjectId && g.classes.some((c) => c.classId === classId)
    );

    const subjectTeachers = teachers
      .filter((t) => t.subjects.some((ts) => ts.subjectId === req.subjectId))
      .map((t) => ({ id: t.id, name: t.name, maxHoursPerWeek: t.maxHoursPerWeek ?? null }));

    let candidateTeachers = subjectTeachers;
    if (sg) {
      const preferred = subjectTeachers.find((t) => t.id === sg.teacherId);
      if (preferred) {
        candidateTeachers = [preferred, ...subjectTeachers.filter((t) => t.id !== preferred.id)];
      }
    }
    // For homeroom subjects, always include the homeroom teacher even if they lack the subject in their subjects list
    if (isHomeroom && homeroomTeacherId && !candidateTeachers.some((t) => t.id === homeroomTeacherId)) {
      const homeroomTeacher = teachers.find((t) => t.id === homeroomTeacherId);
      if (homeroomTeacher) {
        candidateTeachers = [
          { id: homeroomTeacher.id, name: homeroomTeacher.name, maxHoursPerWeek: homeroomTeacher.maxHoursPerWeek ?? null },
          ...candidateTeachers,
        ];
      }
    }

    return {
      subjectId: req.subjectId,
      subjectName: req.subject.name,
      subjectColor: req.subject.color ?? "#4d90fe",
      hoursPerWeek: req.hoursPerWeek,
      candidateTeachers,
      studyGroupId: sg?.id ?? null,
      noConsecutive: options?.noConsecutiveSubjectIds?.includes(req.subjectId) ?? false,
      forcedTeacherId: homeroomTeacherId ?? null,
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
    dayLastPeriods: options?.dayLastPeriods,
    allowedRoomIds,
    excludedTeacherIds,
  });

  return { output, placed: output.placed };
}

// ─── Auto-schedule a subject for an entire grade ──────────────────────────────

export async function autoScheduleGradeLevelSubjects(
  primaryClassId: string,
  subjectIds: string[],
  options?: {
    dayLastPeriods?: number[];
    noConsecutiveSubjectIds?: string[];
  }
): Promise<{
  output: SchedulerOutput;
  placed: {
    day: number; period: number; classId: string; teacherId: string;
    subjectId: string; roomId: string | null; studyGroupId: string | null;
    subjectName: string; subjectColor: string; teacherName: string;
    className: string; roomName?: string;
  }[];
}> {
  const schoolId = await getSchoolId();

  const primaryClass = await prisma.class.findFirst({
    where: { id: primaryClassId, schoolId },
  });
  if (!primaryClass) throw new Error("כיתה לא נמצאה");

  // Load all classes in the same grade
  const gradeClasses = await prisma.class.findMany({
    where: { schoolId, grade: primaryClass.grade },
    include: {
      layer: { include: { allowedRooms: { select: { roomId: true } } } },
      studyGroupLinks: { include: { studyGroup: { include: { teacher: true } } } },
    },
  });

  const [existingSlots, rooms, constraints, teachers, studyGroups, school] = await Promise.all([
    prisma.timetableSlot.findMany({
      where: { class: { schoolId } },
      select: { day: true, period: true, classId: true, teacherId: true, roomId: true, studyGroupId: true },
    }),
    prisma.room.findMany({ where: { schoolId } }),
    prisma.teacherConstraint.findMany({ where: { teacher: { schoolId } } }),
    prisma.teacher.findMany({ where: { schoolId } }),
    prisma.studyGroup.findMany({
      where: { subject: { schoolId } },
      include: {
        classes: { select: { classId: true } },
        teacher: { select: { id: true, name: true, maxHoursPerWeek: true } },
      },
    }),
    prisma.school.findFirst({ where: { id: schoolId } }),
  ]);

  const dayCount = school?.dayCount ?? 6;
  const periodCount = school?.periodCount ?? 9;

  const existingSlotsFormatted = existingSlots.map((s) => ({
    day: s.day, period: s.period, classId: s.classId, teacherId: s.teacherId, roomId: s.roomId,
  }));

  const roomsFormatted = rooms.map((r) => ({
    id: r.id, name: r.name, capacity: r.capacity, maxConcurrentClasses: r.maxConcurrentClasses,
  }));

  const constraintsFormatted = constraints.map((c) => ({
    teacherId: c.teacherId, type: c.type, day: c.day, period: c.period,
  }));

  const allPlaced: SchedulerOutput["placed"] = [];
  const allUnplaced: SchedulerOutput["unplaced"] = [];

  for (const subjectId of subjectIds) {
    const subjectData = await prisma.subject.findFirst({ where: { id: subjectId } });
    if (!subjectData) continue;

    const reqRow = await prisma.classSubjectRequirement.findFirst({
      where: { classId: primaryClassId, subjectId },
    });
    const hoursPerWeek = reqRow?.hoursPerWeek ?? 1;

    // Build one assignment per class
    const assignments: GradeLevelAssignment[] = gradeClasses.map((gc) => {
      const sg = studyGroups.find(
        (g) => g.subjectId === subjectId && g.classes.some((c) => c.classId === gc.id)
      );
      const teacher = sg?.teacher ?? teachers[0]; // fallback to first teacher
      const allowedRoomIds =
        gc.layer && gc.layer.allowedRooms.length > 0
          ? gc.layer.allowedRooms.map((lr) => lr.roomId)
          : null;

      return {
        classId: gc.id,
        className: gc.name,
        studentCount: gc.studentCount,
        teacherId: teacher?.id ?? "",
        teacherName: teacher?.name ?? "",
        maxHoursPerWeek: sg
          ? (studyGroups.find((g) => g.id === sg.id)?.teacher?.maxHoursPerWeek ?? null)
          : null,
        studyGroupId: sg?.id ?? null,
        allowedRoomIds,
      };
    }).filter((a) => a.teacherId !== "");

    const gradeOutput = runGradeLevelScheduler({
      subjectId,
      subjectName: subjectData.name,
      subjectColor: subjectData.color ?? "#4d90fe",
      hoursPerWeek,
      noConsecutive: options?.noConsecutiveSubjectIds?.includes(subjectId),
      assignments,
      existingSlots: existingSlotsFormatted,
      rooms: roomsFormatted,
      constraints: constraintsFormatted,
      dayCount,
      periodCount,
      dayLastPeriods: options?.dayLastPeriods,
    });

    allPlaced.push(...gradeOutput.placed);
    allUnplaced.push(...gradeOutput.unplaced);

    // Extend existing slots so next subject sees placements from this one
    existingSlotsFormatted.push(
      ...gradeOutput.placed.map((p) => ({
        day: p.day, period: p.period, classId: p.classId,
        teacherId: p.teacherId, roomId: p.roomId, studyGroupId: p.studyGroupId,
      }))
    );
  }

  return {
    output: { placed: allPlaced, unplaced: allUnplaced },
    placed: allPlaced,
  };
}

// ─── Edit study group ─────────────────────────────────────────────────────────

export async function updateStudyGroup(
  id: string,
  data: {
    name: string;
    subjectId: string;
    level: string;
    teacherId: string;
    classIds: string[];
  }
): Promise<void> {
  const schoolId = await getSchoolId();

  // Verify the study group belongs to this school
  const sg = await prisma.studyGroup.findFirst({
    where: { id, subject: { schoolId } },
  });
  if (!sg) throw new Error("קבוצת הלימוד לא נמצאה");

  await prisma.$transaction([
    prisma.studyGroup.update({
      where: { id },
      data: {
        name: data.name,
        subjectId: data.subjectId,
        level: data.level,
        teacherId: data.teacherId,
      },
    }),
    prisma.studyGroupClass.deleteMany({ where: { studyGroupId: id } }),
    ...data.classIds.map((classId) =>
      prisma.studyGroupClass.create({ data: { studyGroupId: id, classId } })
    ),
  ]);

  revalidatePath("/study-groups");
  revalidatePath("/settings");
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
