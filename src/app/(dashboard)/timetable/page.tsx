import { loadTimetableData } from "@/lib/timetable-actions";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TimetablePageClient } from "./timetable-page-client";
import { Toaster } from "@/components/ui/sonner";
import { EVENT_TYPE_HE } from "@/lib/event-helpers";
import { CalendarDays } from "lucide-react";

export default async function TimetablePage() {
  const session = await auth();
  const schoolId = (session?.user as Record<string, unknown>)?.schoolId as string;

  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  const periodCount = school?.periodCount ?? 9;
  const dayCount = school?.dayCount ?? 6;
  const periodTimes: { start: string; end: string }[] = school?.periodTimes
    ? JSON.parse(school.periodTimes)
    : [];

  const now = new Date();
  const soon = new Date(now);
  soon.setDate(soon.getDate() + 7);

  const activeOrUpcomingEvents = await prisma.event.findMany({
    where: {
      schoolId,
      endAt: { gte: now },
      startAt: { lte: soon },
    },
    include: {
      participatingClasses: { include: { class: { select: { name: true } } } },
    },
    orderBy: { startAt: "asc" },
  });

  const data = await loadTimetableData();

  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

  return (
    <>
      <div className="flex flex-col h-[calc(100vh-3.5rem-3rem)] gap-0">
        <div className="mb-4">
          <h2 className="text-2xl font-bold">מערכת שעות</h2>
        </div>
        {activeOrUpcomingEvents.length > 0 && (
          <div className="mb-3 space-y-1.5">
            {activeOrUpcomingEvents.map((ev) => {
              const start = new Date(ev.startAt);
              const end = new Date(ev.endAt);
              const isActive = start <= now && now <= end;
              return (
                <div
                  key={ev.id}
                  className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                    isActive
                      ? "bg-amber-50 border-amber-300 text-amber-900"
                      : "bg-blue-50 border-blue-200 text-blue-900"
                  }`}
                >
                  <CalendarDays className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium">
                      {isActive ? "אירוע פעיל: " : "אירוע קרוב: "}
                      {ev.name}
                      {ev.eventType && (
                        <span className="ms-1 text-xs opacity-75">
                          ({EVENT_TYPE_HE[ev.eventType] ?? ev.eventType})
                        </span>
                      )}
                    </div>
                    <div className="text-xs opacity-80">
                      {fmt(start)} – {fmt(end)}
                      {ev.participatingClasses.length > 0 && (
                        <span className="ms-2">
                          • כיתות: {ev.participatingClasses.map((c) => c.class.name).join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <TimetablePageClient
          initialData={data}
          periodCount={periodCount}
          dayCount={dayCount}
          periodTimes={periodTimes}
        />
      </div>
      <Toaster position="top-center" richColors />
    </>
  );
}
