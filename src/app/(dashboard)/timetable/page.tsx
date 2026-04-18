import { loadTimetableData } from "@/lib/timetable-actions";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TimetablePageClient } from "./timetable-page-client";
import { Toaster } from "@/components/ui/sonner";

export default async function TimetablePage() {
  const session = await auth();
  const schoolId = (session?.user as Record<string, unknown>)?.schoolId as string;

  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  const periodCount = school?.periodCount ?? 9;
  const periodTimes: { start: string; end: string }[] = school?.periodTimes
    ? JSON.parse(school.periodTimes)
    : [];

  const data = await loadTimetableData();

  return (
    <>
      <div className="flex flex-col h-[calc(100vh-3.5rem-3rem)] gap-0">
        <div className="mb-4">
          <h2 className="text-2xl font-bold">מערכת שעות — v2</h2>
        </div>
        <TimetablePageClient
          initialData={data}
          periodCount={periodCount}
          periodTimes={periodTimes}
        />
      </div>
      <Toaster position="top-center" richColors />
    </>
  );
}
