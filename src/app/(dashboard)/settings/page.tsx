import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const session = await auth();
  const schoolId = (session?.user as Record<string, unknown>)?.schoolId as string;

  const [teachers, classes, rooms, subjects, studyGroups, school, users, layers] = await Promise.all([
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
      include: { layers: { select: { layerId: true } } },
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
    prisma.layer.findMany({ where: { schoolId }, orderBy: { order: "asc" } }),
  ]);

  return (
    <SettingsClient
      teachers={teachers}
      classes={classes}
      rooms={rooms}
      subjects={subjects}
      studyGroups={studyGroups}
      school={school}
      users={users}
      layers={layers}
    />
  );
}
