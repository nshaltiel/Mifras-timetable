import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getDashboardInsights } from "@/lib/dashboard-actions";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Panel, PanelHead, PanelBody } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { PERIOD_LABELS, DAYS_HE, ABSENCE_REASON_HE } from "@/lib/constants";
import {
  UserMinus, ArrowLeftRight, CalendarDays, Users,
  AlertTriangle, Compass, ChevronLeft,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const SOLUTION_LABELS: Record<string, string> = {
  SUBSTITUTE_TEACHER: "מורה מחליף",
  CANCEL_LESSON: "ביטול שיעור",
  MERGE_CLASSES: "מיזוג כיתות",
  TIME_SWAP: "החלפת שיעורים",
  DISSOLVE_STUDY_GROUP: "פירוק קבוצה",
  DISTRIBUTE_TO_HOMEROOM: "שיעור עצמי",
  SELF_STUDY: "שיעור עצמי",
};

const DOW_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export default async function DashboardPage() {
  const session = await auth();
  const schoolId = (session?.user as Record<string, unknown>)?.schoolId as string;

  if (!schoolId) return <div>לא נמצא בית ספר</div>;

  const today = new Date().toISOString().slice(0, 10);

  // Week start/end (Sun–Fri)
  const todayDate = new Date();
  const dow = todayDate.getDay();
  const weekStart = new Date(todayDate);
  weekStart.setDate(todayDate.getDate() - dow);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 5);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const [unresolvedAbsencesRaw, todayAbsences, todaySubstitutions, totalSlots, insights] =
    await Promise.all([
      prisma.absence.findMany({
        where: { teacher: { schoolId }, status: { in: ["UNRESOLVED", "PARTIALLY_RESOLVED"] } },
        include: {
          teacher: { select: { id: true, name: true } },
          substitutions: { select: { period: true, solutionType: true } },
        },
        orderBy: [{ date: "desc" }],
      }),
      prisma.absence.findMany({
        where: { date: today, teacher: { schoolId } },
        include: { teacher: { select: { id: true, name: true } } },
        orderBy: { teacher: { name: "asc" } },
      }),
      prisma.substitution.findMany({
        where: { absence: { date: today, teacher: { schoolId } } },
        include: {
          absence: { include: { teacher: { select: { id: true, name: true } } } },
          substituteTeacher: { select: { id: true, name: true } },
        },
        orderBy: { period: "asc" },
      }),
      prisma.timetableSlot.count({ where: { class: { schoolId } } }),
      getDashboardInsights(weekStartStr, weekEndStr),
    ]);

  const absentTeachersToday = new Set(todayAbsences.map((a) => a.teacherId)).size;
  const subDone = todaySubstitutions.filter(
    (s) => s.solutionType !== "CANCEL_LESSON"
  ).length;

  // Enrich unresolved absences with teachable periods
  const unresolvedAbsences = await Promise.all(
    unresolvedAbsencesRaw.map(async (absence) => {
      const periods: number[] = JSON.parse(absence.periods);
      const dayOfWeek = new Date(absence.date + "T12:00:00").getDay();
      const slots = await prisma.timetableSlot.findMany({
        where: { teacherId: absence.teacherId, day: dayOfWeek, period: { in: periods } },
        select: { period: true },
      });
      return { ...absence, teachablePeriods: slots.map((s) => s.period) };
    })
  );

  function formatDate(d: string) {
    return new Date(d + "T12:00:00").toLocaleDateString("he-IL", {
      weekday: "short", day: "numeric", month: "short",
    });
  }

  const subsByPeriod = todaySubstitutions.reduce<Record<number, typeof todaySubstitutions>>(
    (acc, sub) => {
      if (!acc[sub.period]) acc[sub.period] = [];
      acc[sub.period].push(sub);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6">
      <PageHeader title="לוח בקרה" subtitle={`${new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`} />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard
          variant="accent"
          icon={<UserMinus />}
          value={todayAbsences.length}
          label="היעדרויות היום"
        />
        <StatCard
          variant="navy"
          icon={<Users />}
          value={absentTeachersToday}
          label="מורים נעדרים היום"
        />
        <StatCard
          variant="gold"
          icon={<ArrowLeftRight />}
          value={todaySubstitutions.length}
          label="מילויי מקום היום"
          trend={
            todaySubstitutions.length > 0
              ? `${Math.round((subDone / todaySubstitutions.length) * 100)}% סגורים`
              : undefined
          }
        />
        <StatCard
          variant="sky"
          icon={<CalendarDays />}
          value={totalSlots}
          label="שיעורים במערכת"
        />
      </div>

      {/* Main layout: main + insights aside */}
      <div className="flex gap-6 items-start">
        {/* Left column (main) */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Unresolved absences panel */}
          <Panel>
            <PanelHead
              icon={<AlertTriangle />}
              title="היעדרויות שדורשות טיפול"
              count={unresolvedAbsences.length || undefined}
              actions={
                <Link href="/absences">
                  <Button variant="ghost" size="sm" className="text-mifras-orange-600 gap-1">
                    ראה הכל
                    <ChevronLeft className="size-3.5" />
                  </Button>
                </Link>
              }
            />
            <PanelBody className="p-0">
              {unresolvedAbsences.length === 0 ? (
                <p className="text-center text-mifras-ink-400 text-[13.5px] py-8">אין היעדרויות שלא טופלו</p>
              ) : (
                <ul className="divide-y divide-mifras-ink-100">
                  {unresolvedAbsences.slice(0, 6).map((absence) => {
                    const resolvedPeriods = absence.substitutions.map((s) => s.period);
                    const unresolved = absence.teachablePeriods.filter((p) => !resolvedPeriods.includes(p));
                    const isPartial = absence.status === "PARTIALLY_RESOLVED";
                    return (
                      <li key={absence.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-mifras-ink-50 transition-colors">
                        {/* Avatar */}
                        <div className="size-8 rounded-full bg-mifras-navy-50 text-mifras-navy-700 flex items-center justify-center text-[12px] font-semibold shrink-0">
                          {absence.teacher.name.slice(0, 1)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13.5px] font-semibold text-mifras-ink-900 truncate">
                            {absence.teacher.name}
                          </div>
                          <div className="text-[11.5px] text-mifras-ink-400 mt-0.5">
                            {formatDate(absence.date)}
                          </div>
                        </div>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {unresolved.map((p) => (
                            <span
                              key={p}
                              className="inline-flex items-center px-1.5 h-[20px] rounded-md text-[10.5px] bg-red-50 text-mifras-danger font-medium"
                            >
                              ש׳ {p + 1}
                            </span>
                          ))}
                          {resolvedPeriods.map((p) => (
                            <span
                              key={`r-${p}`}
                              className="inline-flex items-center px-1.5 h-[20px] rounded-md text-[10.5px] bg-emerald-50 text-mifras-success font-medium"
                            >
                              ✓ {p + 1}
                            </span>
                          ))}
                        </div>
                        <StatusPill tone={isPartial ? "partial" : "open"} className="shrink-0">
                          {isPartial ? "חלקי" : "פתוח"}
                        </StatusPill>
                        <Link href={`/substitutions/${absence.id}`} className="shrink-0">
                          <Button variant="ghost" size="sm" className="text-mifras-orange-600 gap-0.5 h-7 px-2">
                            המשך טיפול
                            <ChevronLeft className="size-3" />
                          </Button>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </PanelBody>
          </Panel>

          {/* Today substitutions table */}
          {todaySubstitutions.length > 0 && (
            <Panel>
              <PanelHead
                icon={<ArrowLeftRight />}
                title="מילוי מקום היום"
                count={todaySubstitutions.length}
              />
              <PanelBody className="p-0 overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-mifras-paper border-b border-mifras-ink-100">
                      {["שעה", "מורה נעדר", "פתרון", "מחליף"].map((h) => (
                        <th key={h} className="text-start px-4 py-2.5 font-semibold text-mifras-navy-700 text-[12px]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-mifras-ink-100">
                    {Object.keys(subsByPeriod)
                      .sort((a, b) => Number(a) - Number(b))
                      .flatMap((p) =>
                        subsByPeriod[Number(p)].map((sub, i) => (
                          <tr key={sub.id} className="hover:bg-mifras-ink-50">
                            {i === 0 && (
                              <td
                                className="px-4 py-3 font-semibold text-mifras-navy-700"
                                rowSpan={subsByPeriod[Number(p)].length}
                              >
                                {PERIOD_LABELS[Number(p)] || `שיעור ${Number(p) + 1}`}
                              </td>
                            )}
                            <td className="px-4 py-3">{sub.absence.teacher.name}</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex px-2 h-[20px] rounded-md text-[11px] bg-mifras-ink-50 text-mifras-ink-700 items-center">
                                {SOLUTION_LABELS[sub.solutionType] || sub.solutionType}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-mifras-ink-500">
                              {sub.substituteTeacher?.name || "—"}
                            </td>
                          </tr>
                        ))
                      )}
                  </tbody>
                </table>
              </PanelBody>
            </Panel>
          )}
        </div>

        {/* Right aside — insights */}
        <aside className="w-[340px] shrink-0">
          <Panel className="relative overflow-hidden">
            <PanelHead
              icon={<Compass />}
              title="תובנות השבוע"
            />
            <PanelBody className="space-y-4 text-[13.5px] text-mifras-ink-700 leading-relaxed">
              {/* Absences resolution rate */}
              <p>
                <b className="text-mifras-navy-700">היעדרויות השבוע:</b>{" "}
                {insights.absencesWeek.total} היעדרויות —{" "}
                <span className="text-mifras-success font-semibold">
                  {insights.absencesWeek.resolutionRate}% נסגרו
                </span>
                {insights.absencesWeek.topReasons[0] && (
                  <>, הסיבה הנפוצה: {ABSENCE_REASON_HE[insights.absencesWeek.topReasons[0].reason] ?? insights.absencesWeek.topReasons[0].reason}</>
                )}
              </p>

              {/* Room utilization */}
              {insights.roomUtil.length > 0 && (
                <p>
                  <b className="text-mifras-navy-700">ניצולת חדרים:</b>{" "}
                  הכי עמוס: {insights.roomUtil[0].roomName} ({Math.round(insights.roomUtil[0].utilization * 100)}%){" "}
                  {insights.roomUtil.length > 1 && (
                    <>· הכי פנוי: {insights.roomUtil[insights.roomUtil.length - 1].roomName} ({Math.round(insights.roomUtil[insights.roomUtil.length - 1].utilization * 100)}%)</>
                  )}
                </p>
              )}

              {/* Top substitutes */}
              {insights.subLeaders.length > 0 && (
                <p>
                  <b className="text-mifras-navy-700">ממלאי מקום מובילים (14 יום):</b>{" "}
                  {insights.subLeaders.map((l) => `${l.teacherName} ${l.count}`).join(", ")}
                </p>
              )}

              {/* Absence patterns */}
              {insights.patterns.length > 0 && (
                <div className="space-y-1">
                  <b className="text-mifras-navy-700 block">תבניות היעדרות שזוהו:</b>
                  {insights.patterns.map((p, i) => (
                    <p key={i} className="text-[12.5px] text-mifras-ink-500">
                      {p.teacherName} — {Math.round(p.share * 100)}% מהיעדרויותיה ביום{" "}
                      {DOW_HE[p.bucket]}
                    </p>
                  ))}
                </div>
              )}
            </PanelBody>

            {/* Decorative boat watermark */}
            <div className="absolute bottom-0 end-0 opacity-[0.07] pointer-events-none">
              <Image src="/brand/boat.png" alt="" width={160} height={120} className="object-contain" />
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
