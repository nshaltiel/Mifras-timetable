import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelHead, PanelBody } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { Chip } from "@/components/ui/mifras-chip";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, ChevronLeft, Printer } from "lucide-react";
import { PERIOD_LABELS } from "@/lib/constants";

const SOLUTION_LABELS: Record<string, string> = {
  SUBSTITUTE_TEACHER: "מורה מחליף",
  CANCEL_LESSON: "ביטול שיעור",
  MERGE_CLASSES: "מיזוג כיתות",
  TIME_SWAP: "החלפת שיעורים",
  DISSOLVE_STUDY_GROUP: "פירוק קבוצה",
  DISTRIBUTE_TO_HOMEROOM: "פיקוח מחנך",
  SELF_STUDY: "שיעור עצמי",
};

const SOLUTION_TONE: Record<string, "navy" | "sky" | "gold" | "accent" | "ghost"> = {
  SUBSTITUTE_TEACHER: "navy",
  CANCEL_LESSON: "accent",
  MERGE_CLASSES: "gold",
  TIME_SWAP: "sky",
  SELF_STUDY: "ghost",
  DISSOLVE_STUDY_GROUP: "ghost",
  DISTRIBUTE_TO_HOMEROOM: "gold",
};

function statusTone(s: string): "done" | "partial" | "open" | "neutral" {
  if (s === "RESOLVED") return "done";
  if (s === "PARTIALLY_RESOLVED") return "partial";
  return "open";
}
function statusLabel(s: string) {
  if (s === "RESOLVED") return "תוקן";
  if (s === "PARTIALLY_RESOLVED") return "חלקי";
  return "פתוח";
}

export default async function SubstitutionsPage() {
  const session = await auth();
  const schoolId = (session?.user as Record<string, unknown>)?.schoolId as string;

  const today = new Date().toISOString().slice(0, 10);

  const [todayAbsencesRaw, recentAbsences] = await Promise.all([
    prisma.absence.findMany({
      where: { date: today, teacher: { schoolId }, status: { not: "NOT_REQUIRED" } },
      include: {
        teacher: { select: { id: true, name: true } },
        substitutions: {
          include: { substituteTeacher: { select: { name: true } } },
        },
      },
    }),
    prisma.absence.findMany({
      where: {
        teacher: { schoolId },
        date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) },
        status: { not: "NOT_REQUIRED" },
      },
      include: {
        teacher: { select: { id: true, name: true } },
        substitutions: { select: { id: true } },
      },
      orderBy: { date: "desc" },
      take: 20,
    }),
  ]);

  const todayDayOfWeek = new Date(today + "T12:00:00").getDay();
  const todayAbsences = await Promise.all(
    todayAbsencesRaw.map(async (absence) => {
      const periods: number[] = JSON.parse(absence.periods);
      const slots = await prisma.timetableSlot.findMany({
        where: { teacherId: absence.teacherId, day: todayDayOfWeek, period: { in: periods } },
        select: { period: true },
      });
      return { ...absence, teachablePeriods: slots.map((s) => s.period) };
    })
  );

  const todayLabel = new Date().toLocaleDateString("he-IL", {
    weekday: "long", day: "numeric", month: "long",
  });

  function formatDate(dateStr: string) {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("he-IL", {
      weekday: "short", day: "numeric", month: "short",
    });
  }

  // Build a flat substitutions table for printing
  const allSubRows: {
    period: number; teacherName: string; solutionType: string; substituteName?: string; status: string;
  }[] = todayAbsences.flatMap((absence) =>
    absence.teachablePeriods.map((p) => {
      const sub = absence.substitutions.find((s) => s.period === p);
      return {
        period: p,
        teacherName: absence.teacher.name,
        solutionType: sub?.solutionType ?? "",
        substituteName: sub?.substituteTeacher?.name,
        status: absence.status,
      };
    })
  ).sort((a, b) => a.period - b.period);

  return (
    <div className="space-y-5">
      <PageHeader
        title="לוח שינויים"
        subtitle={`מילוי מקום · ${todayLabel}`}
        actions={
          <Button variant="outline" className="gap-1.5" onClick={undefined}>
            <Printer className="size-3.5" />
            הדפסה
          </Button>
        }
      />

      {/* Today panel — flat substitution table */}
      <Panel>
        <PanelHead
          icon={<ArrowLeftRight />}
          title={`היום · ${allSubRows.length} מילויי מקום`}
          count={todayAbsences.filter((a) => a.status !== "RESOLVED").length || undefined}
        />
        {todayAbsences.length === 0 ? (
          <PanelBody className="py-12 text-center">
            <ArrowLeftRight className="size-10 mx-auto text-mifras-ink-200 mb-3" />
            <p className="text-mifras-ink-400 text-[13.5px]">אין היעדרויות היום</p>
          </PanelBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-mifras-paper border-b border-mifras-ink-100">
                  {["שעה", "מורה נעדר", "כיתה", "פתרון", "מחליף", ""].map((h) => (
                    <th key={h} className="text-start px-4 py-3 font-semibold text-mifras-navy-700 text-[12px]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-mifras-ink-100">
                {todayAbsences.map((absence) =>
                  absence.teachablePeriods.map((p) => {
                    const sub = absence.substitutions.find((s) => s.period === p);
                    return (
                      <tr key={`${absence.id}-${p}`} className="hover:bg-mifras-ink-50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-mifras-navy-700">
                          {PERIOD_LABELS[p] || `ש' ${p + 1}`}
                        </td>
                        <td className="px-4 py-3">{absence.teacher.name}</td>
                        <td className="px-4 py-3 text-mifras-ink-500">—</td>
                        <td className="px-4 py-3">
                          {sub ? (
                            <Chip tone={SOLUTION_TONE[sub.solutionType] ?? "ghost"}>
                              {SOLUTION_LABELS[sub.solutionType] ?? sub.solutionType}
                            </Chip>
                          ) : (
                            <StatusPill tone="open">לא תוקן</StatusPill>
                          )}
                        </td>
                        <td className="px-4 py-3 text-mifras-ink-500">
                          {sub?.substituteTeacher?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/substitutions/${absence.id}`}>
                            <Button variant="ghost" size="sm" className="gap-1 text-mifras-orange-600 h-7 px-2 text-[12px]">
                              {sub ? "עדכן" : "טפל"}
                              <ChevronLeft className="size-3" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Recent 7 days */}
      {recentAbsences.filter((a) => a.date !== today).length > 0 && (
        <Panel>
          <PanelHead title="7 ימים אחרונים" />
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-mifras-paper border-b border-mifras-ink-100">
                  {["תאריך", "מורה", "סטטוס", ""].map((h) => (
                    <th key={h} className="text-start px-4 py-3 font-semibold text-mifras-navy-700 text-[12px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-mifras-ink-100">
                {recentAbsences
                  .filter((a) => a.date !== today)
                  .map((absence) => (
                    <tr key={absence.id} className="hover:bg-mifras-ink-50 transition-colors">
                      <td className="px-4 py-3 text-mifras-ink-500">{formatDate(absence.date)}</td>
                      <td className="px-4 py-3 font-medium text-mifras-ink-900">{absence.teacher.name}</td>
                      <td className="px-4 py-3">
                        <StatusPill tone={statusTone(absence.status)}>
                          {statusLabel(absence.status)}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/substitutions/${absence.id}`}>
                          <Button variant="ghost" size="icon" className="size-7 text-mifras-ink-400 hover:text-mifras-orange-600">
                            <ChevronLeft className="size-3.5" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
