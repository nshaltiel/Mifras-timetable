"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { auth } from "./auth";
import { teacherSchema, classSchema, roomSchema, subjectSchema } from "./validators";

async function getSchoolId() {
  const session = await auth();
  const schoolId = (session?.user as Record<string, unknown>)?.schoolId as string;
  if (!schoolId) throw new Error("לא מחובר");
  return schoolId;
}

// ─── Teachers ────────────────────────────────────

export async function createTeacher(data: FormData) {
  const schoolId = await getSchoolId();
  const subjectIds = data.getAll("subjectIds").map(String).filter(Boolean);
  const parsed = teacherSchema.parse({
    name: data.get("name"),
    email: data.get("email"),
    phone: data.get("phone"),
    gender: data.get("gender") || "UNSPECIFIED",
    maxHoursPerWeek: data.get("maxHoursPerWeek") || undefined,
    considerationPercent: data.get("considerationPercent") || 0,
    personalSituation: data.get("personalSituation") || undefined,
  });

  // Parse constraints from form data
  const constraintsRaw = data.get("constraints");
  type ConstraintCell = { day: number; period: number; type: string };
  const constraintCells: ConstraintCell[] = constraintsRaw
    ? (JSON.parse(constraintsRaw as string) as ConstraintCell[])
    : [];

  const teacher = await prisma.teacher.create({
    data: {
      name: parsed.name,
      email: parsed.email || null,
      phone: parsed.phone || null,
      gender: parsed.gender,
      maxHoursPerWeek: parsed.maxHoursPerWeek ? Number(parsed.maxHoursPerWeek) : null,
      considerationPercent: parsed.considerationPercent ? Number(parsed.considerationPercent) : 0,
      personalSituation: parsed.personalSituation || null,
      schoolId,
      subjects: subjectIds.length > 0
        ? { create: subjectIds.map((sid) => ({ subjectId: sid })) }
        : undefined,
    },
  });

  if (constraintCells.length > 0) {
    await prisma.teacherConstraint.createMany({
      data: constraintCells.map((c) => ({
        teacherId: teacher.id,
        type: c.type,
        day: c.day,
        period: c.period,
      })),
    });
  }

  revalidatePath("/settings");
  revalidatePath("/timetable");
  return { id: teacher.id };
}

export async function updateTeacher(id: string, data: FormData) {
  const schoolId = await getSchoolId();
  const subjectIds = data.getAll("subjectIds").map(String).filter(Boolean);
  const parsed = teacherSchema.parse({
    name: data.get("name"),
    email: data.get("email"),
    phone: data.get("phone"),
    gender: data.get("gender") || "UNSPECIFIED",
    maxHoursPerWeek: data.get("maxHoursPerWeek") || undefined,
    considerationPercent: data.get("considerationPercent") || 0,
    personalSituation: data.get("personalSituation") || undefined,
  });

  // Parse constraints from form data
  const constraintsRaw = data.get("constraints");
  type ConstraintCell = { day: number; period: number; type: string };
  const constraintCells: ConstraintCell[] = constraintsRaw
    ? (JSON.parse(constraintsRaw as string) as ConstraintCell[])
    : [];

  await prisma.$transaction([
    prisma.teacher.update({
      where: { id, schoolId },
      data: {
        name: parsed.name,
        email: parsed.email || null,
        phone: parsed.phone || null,
        gender: parsed.gender,
        maxHoursPerWeek: parsed.maxHoursPerWeek ? Number(parsed.maxHoursPerWeek) : null,
        considerationPercent: parsed.considerationPercent ? Number(parsed.considerationPercent) : 0,
        personalSituation: parsed.personalSituation || null,
        subjects: {
          deleteMany: {},
          create: subjectIds.map((sid) => ({ subjectId: sid })),
        },
      },
    }),
    prisma.teacherConstraint.deleteMany({ where: { teacherId: id } }),
    ...(constraintCells.length > 0
      ? [prisma.teacherConstraint.createMany({
          data: constraintCells.map((c) => ({
            teacherId: id,
            type: c.type,
            day: c.day,
            period: c.period,
          })),
        })]
      : []),
  ]);

  revalidatePath("/settings");
  revalidatePath("/timetable");
}

export async function deleteTeacher(id: string) {
  const schoolId = await getSchoolId();
  await prisma.teacher.delete({ where: { id, schoolId } });
  revalidatePath("/settings");
}

// ─── Classes ─────────────────────────────────────

export async function createClass(data: FormData) {
  const schoolId = await getSchoolId();
  const parsed = classSchema.parse({
    name: data.get("name"),
    grade: data.get("grade"),
    studentCount: data.get("studentCount") || 0,
    homeroomTeacherId: data.get("homeroomTeacherId"),
  });

  await prisma.class.create({
    data: {
      name: parsed.name,
      grade: parsed.grade,
      studentCount: parsed.studentCount,
      homeroomTeacherId: parsed.homeroomTeacherId || null,
      schoolId,
    },
  });

  revalidatePath("/settings");
}

export async function updateClass(id: string, data: FormData) {
  const schoolId = await getSchoolId();
  const parsed = classSchema.parse({
    name: data.get("name"),
    grade: data.get("grade"),
    studentCount: data.get("studentCount") || 0,
    homeroomTeacherId: data.get("homeroomTeacherId"),
  });

  await prisma.class.update({
    where: { id, schoolId },
    data: {
      name: parsed.name,
      grade: parsed.grade,
      studentCount: parsed.studentCount,
      homeroomTeacherId: parsed.homeroomTeacherId || null,
    },
  });

  revalidatePath("/settings");
}

export async function deleteClass(id: string) {
  const schoolId = await getSchoolId();
  await prisma.class.delete({ where: { id, schoolId } });
  revalidatePath("/settings");
}

// ─── Rooms ───────────────────────────────────────

export async function createRoom(data: FormData) {
  const schoolId = await getSchoolId();
  const parsed = roomSchema.parse({
    name: data.get("name"),
    capacity: data.get("capacity"),
    type: data.get("type"),
    maxConcurrentClasses: data.get("maxConcurrentClasses") || 1,
  });

  await prisma.room.create({
    data: { ...parsed, schoolId },
  });

  revalidatePath("/settings");
}

export async function updateRoom(id: string, data: FormData) {
  const schoolId = await getSchoolId();
  const parsed = roomSchema.parse({
    name: data.get("name"),
    capacity: data.get("capacity"),
    type: data.get("type"),
    maxConcurrentClasses: data.get("maxConcurrentClasses") || 1,
  });

  await prisma.room.update({
    where: { id, schoolId },
    data: parsed,
  });

  revalidatePath("/settings");
}

export async function deleteRoom(id: string) {
  const schoolId = await getSchoolId();
  await prisma.room.delete({ where: { id, schoolId } });
  revalidatePath("/settings");
}

// ─── Subjects ────────────────────────────────────

export async function createSubject(data: FormData) {
  const schoolId = await getSchoolId();
  const parsed = subjectSchema.parse({
    name: data.get("name"),
    category: data.get("category"),
    color: data.get("color"),
  });

  await prisma.subject.create({
    data: {
      name: parsed.name,
      category: parsed.category || null,
      color: parsed.color || null,
      schoolId,
    },
  });

  revalidatePath("/settings");
}

export async function updateSubject(id: string, data: FormData) {
  const schoolId = await getSchoolId();
  const parsed = subjectSchema.parse({
    name: data.get("name"),
    category: data.get("category"),
    color: data.get("color"),
  });

  await prisma.subject.update({
    where: { id, schoolId },
    data: {
      name: parsed.name,
      category: parsed.category || null,
      color: parsed.color || null,
    },
  });

  revalidatePath("/settings");
}

export async function deleteSubject(id: string) {
  const schoolId = await getSchoolId();
  await prisma.subject.delete({ where: { id, schoolId } });
  revalidatePath("/settings");
}

// ─── School Period Times ──────────────────────────

export async function updateSchoolPeriodTimes(times: { start: string; end: string }[]) {
  const schoolId = await getSchoolId();
  await prisma.school.update({
    where: { id: schoolId },
    data: { periodTimes: JSON.stringify(times) },
  });
  revalidatePath("/settings");
}

// ─── Teacher Excel Import ─────────────────────────

export async function importTeachersFromExcel(rows: {
  name: string;
  email?: string;
  phone?: string;
  gender?: string;
  maxHoursPerWeek?: number;
  considerationPercent?: number;
  personalSituation?: string;
}[]): Promise<{ created: number; errors: string[] }> {
  const schoolId = await getSchoolId();
  let created = 0;
  const errors: string[] = [];

  for (const row of rows) {
    if (!row.name || row.name.trim().length < 2) {
      errors.push(`שורה עם שם "${row.name}" — שם לא תקין`);
      continue;
    }
    const gender = ["MALE", "FEMALE"].includes((row.gender || "").toUpperCase())
      ? (row.gender!.toUpperCase() as string)
      : "UNSPECIFIED";
    try {
      await prisma.teacher.create({
        data: {
          name: row.name.trim(),
          email: row.email?.trim() || null,
          phone: row.phone?.trim() || null,
          gender,
          maxHoursPerWeek: row.maxHoursPerWeek ?? null,
          considerationPercent: row.considerationPercent ?? 0,
          personalSituation: row.personalSituation?.trim() || null,
          schoolId,
        },
      });
      created++;
    } catch {
      errors.push(`שורה "${row.name}" — שגיאה בשמירה`);
    }
  }

  revalidatePath("/settings");
  return { created, errors };
}
