import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HoursPlanningClient } from "./hours-planning-client";

export default async function HoursPlanningPage() {
  const session = await auth();
  const schoolId = (session?.user as Record<string, unknown>)?.schoolId as string;

  const [classes, subjects, slots] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
    }),
    prisma.subject.findMany({
      where: { schoolId },
      orderBy: { name: "asc" },
    }),
    prisma.timetableSlot.findMany({
      where: { class: { schoolId } },
      include: {
        teacher: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, color: true } },
        class: { select: { id: true } },
      },
    }),
  ]);

  // Build summary: classId -> subjectId -> { teacherId, teacherName, hours }
  const summary: Record<
    string,
    Record<string, { teacherId: string; teacherName: string; hours: number }>
  > = {};

  for (const slot of slots) {
    if (!summary[slot.classId]) summary[slot.classId] = {};
    const key = slot.subjectId;
    if (!summary[slot.classId][key]) {
      summary[slot.classId][key] = {
        teacherId: slot.teacher.id,
        teacherName: slot.teacher.name,
        hours: 0,
      };
    }
    summary[slot.classId][key].hours += 1;
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <h2 className="text-2xl font-bold">תכנון שעות</h2>
      <HoursPlanningClient
        classes={classes}
        subjects={subjects}
        summary={summary}
      />
    </div>
  );
}
