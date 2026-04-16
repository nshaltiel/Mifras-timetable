import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadStudyGroups } from "@/lib/study-group-actions";
import { StudyGroupsClient } from "./study-groups-client";

export default async function StudyGroupsPage() {
  const session = await auth();
  const schoolId = (session?.user as Record<string, unknown>)?.schoolId as string;

  const [groups, teachers, classes, subjects] = await Promise.all([
    loadStudyGroups(),
    prisma.teacher.findMany({
      where: { schoolId },
      select: { id: true, name: true, subjects: { select: { subject: { select: { id: true } } } } },
      orderBy: { name: "asc" },
    }),
    prisma.class.findMany({
      where: { schoolId },
      select: { id: true, name: true, grade: true },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
    }),
    prisma.subject.findMany({
      where: { schoolId },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold">קבוצות לימוד (הקבצה)</h2>
      <StudyGroupsClient
        groups={groups}
        teachers={teachers}
        classes={classes}
        subjects={subjects}
      />
    </div>
  );
}
