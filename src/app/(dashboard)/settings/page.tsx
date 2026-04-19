import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GRADE_HE } from "@/lib/constants";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const session = await auth();
  const schoolId = (session?.user as Record<string, unknown>)?.schoolId as string;

  const [teachers, classes, rooms, subjects, studyGroups, school, users, events] = await Promise.all([
    prisma.teacher.findMany({
      where: { schoolId },
      include: {
        subjects: { include: { subject: { select: { id: true, name: true } } } },
        homeroomClass: { select: { id: true, name: true } },
        constraints: { select: { type: true, day: true, period: true } },
        _count: { select: { slots: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.class.findMany({
      where: { schoolId },
      include: { homeroomTeacher: { select: { id: true, name: true } } },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
    }),
    prisma.room.findMany({
      where: { schoolId },
      include: { layers: { include: { layer: { select: { order: true } } } } },
      orderBy: { name: "asc" },
    }),
    prisma.subject.findMany({
      where: { schoolId },
      include: { _count: { select: { teachers: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.studyGroup.findMany({
      where: { subject: { schoolId } },
      include: {
        subject: { select: { id: true, name: true, color: true } },
        teacher: { select: { id: true, name: true } },
        classes: { include: { class: { select: { id: true, name: true } } } },
      },
      orderBy: { subject: { name: "asc" } },
    }),
    prisma.school.findUnique({ where: { id: schoolId } }),
    prisma.user.findMany({ where: { schoolId }, orderBy: { createdAt: "asc" } }),
    prisma.event.findMany({
      where: { schoolId },
      include: {
        participatingClasses: { include: { class: { select: { id: true, name: true } } } },
        participatingTeachers: { include: { teacher: { select: { id: true, name: true } } } },
      },
      orderBy: { startAt: "desc" },
    }),
  ]);

  const gradeOptions = [...new Set(classes.map((c) => c.grade))]
    .sort((a, b) => a - b)
    .map((grade) => ({ grade, name: GRADE_HE[grade] || `שכבה ${grade}` }));

  return (
    <SettingsClient
      teachers={teachers}
      classes={classes}
      rooms={rooms}
      subjects={subjects}
      studyGroups={studyGroups}
      school={school}
      users={users}
      gradeOptions={gradeOptions}
      events={events}
    />
  );
}
