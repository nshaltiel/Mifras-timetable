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

export async function createStudyGroup(data: {
  name: string;
  subjectId: string;
  level: string;
  teacherId: string;
  classIds: string[];
}) {
  const schoolId = await getSchoolId();

  // Verify teacher and subject belong to school
  const [teacher, subject] = await Promise.all([
    prisma.teacher.findFirst({ where: { id: data.teacherId, schoolId } }),
    prisma.subject.findFirst({ where: { id: data.subjectId, schoolId } }),
  ]);
  if (!teacher || !subject) throw new Error("Invalid teacher or subject");

  const group = await prisma.studyGroup.create({
    data: {
      name: data.name,
      subjectId: data.subjectId,
      level: data.level,
      teacherId: data.teacherId,
      classes: {
        create: data.classIds.map((classId) => ({ classId })),
      },
    },
    include: {
      subject: true,
      teacher: true,
      classes: { include: { class: true } },
    },
  });

  revalidatePath("/study-groups");
  return group;
}

export async function deleteStudyGroup(id: string) {
  const schoolId = await getSchoolId();
  const group = await prisma.studyGroup.findFirst({
    where: { id, subject: { schoolId } },
  });
  if (!group) throw new Error("Not found");

  await prisma.studyGroup.delete({ where: { id } });
  revalidatePath("/study-groups");
}

export async function loadStudyGroups() {
  const schoolId = await getSchoolId();
  return prisma.studyGroup.findMany({
    where: { subject: { schoolId } },
    include: {
      subject: { select: { id: true, name: true, color: true } },
      teacher: { select: { id: true, name: true } },
      classes: {
        include: { class: { select: { id: true, name: true, grade: true } } },
      },
    },
    orderBy: { subject: { name: "asc" } },
  });
}
