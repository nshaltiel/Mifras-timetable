import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserMinus, AlertTriangle, ArrowLeftRight, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { PERIOD_LABELS } from "@/lib/constants";

const SOLUTION_LABELS: Record<string, string> = {
  SUBSTITUTE_TEACHER: "מורה מחליף",
  CANCEL_LESSON: "ביטול שיעור",
  MERGE_CLASSES: "מיזוג כיתות",
  TIME_SWAP: "החלפת שיעורים",
  DISSOLVE_STUDY_GROUP: "פירוק קבוצה",
  DISTRIBUTE_TO_HOMEROOM: "שיעור עצמי",
  SELF_STUDY: "שיעור עצמי",
};

export default async function DashboardPage() {
  const session = await auth();
  const schoolId = (session?.user as Record<string, unknown>)?.schoolId as string;
  const schoolName = (session?.user as Record<string, unknown>)?.schoolName as string;

  if (!schoolId) {
    return <div>לא נמצא בית ספר</div>;
  }

  const today = new Date().toISOString().slice(0, 10);

  const [unresolvedAbsencesRaw, todayAbsences, todaySubstitutions] = await Promise.all([
    // Unresolved absences (all dates)
    prisma.absence.findMany({
      where: { teacher: { schoolId }, status: { in: ["UNRESOLVED", "PARTIALLY_RESOLVED"] } },
      include: {
        teacher: { select: { id: true, name: true } },
        substitutions: { select: { period: true, solutionType: true } },
      },
      orderBy: [{ date: "desc" }],
    }),
    // Today's absences
    prisma.absence.findMany({
      where: { date: today, teacher: { schoolId } },
      include: {
        teacher: { select: { id: true, name: true } },
      },
      orderBy: { teacher: { name: "asc" } },
    }),
    // Today's substitutions with details
    prisma.substitution.findMany({
      where: {
        absence: { date: today, teacher: { schoolId } },
      },
      include: {
        absence: {
          include: { teacher: { select: { id: true, name: true } } },
        },
        substituteTeacher: { select: { id: true, name: true } },
      },
      orderBy: { period: "asc" },
    }),
  ]);

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

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "short" });
  }

  // Enrich unresolved absences with teachable period count (for correct status display)
  // Group today substitutions by period for easy display
  const subsByPeriod = todaySubstitutions.reduce<Record<number, typeof todaySubstitutions>>((acc, sub) => {
    if (!acc[sub.period]) acc[sub.period] = [];
    acc[sub.period].push(sub);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">לוח בקרה</h2>
        {schoolName && <p className="text-muted-foreground mt-1">{schoolName}</p>}
      </div>

      {/* Unresolved absences */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h3 className="text-lg font-semibold">היעדרויות שלא טופלו</h3>
          {unresolvedAbsences.length > 0 && (
            <Badge variant="destructive" className="text-xs">{unresolvedAbsences.length}</Badge>
          )}
        </div>
        {unresolvedAbsences.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground text-sm">
              <p>אין היעדרויות שלא טופלו</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {unresolvedAbsences.map((absence) => {
              const resolvedPeriods = absence.substitutions.map((s) => s.period);
              const unresolvedPeriods = absence.teachablePeriods.filter(p => !resolvedPeriods.includes(p));
              return (
                <Card key={absence.id} className="border-destructive/30">
                  <CardContent className="py-2.5 px-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-muted-foreground min-w-[4rem]">
                        {formatDate(absence.date)}
                      </span>
                      <span className="font-medium text-sm">{absence.teacher.name}</span>
                      <div className="flex gap-1 flex-wrap">
                        {unresolvedPeriods.map(p => (
                          <span key={p} className="text-xs px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                            {PERIOD_LABELS[p] || `שיעור ${p + 1}`}
                          </span>
                        ))}
                      </div>
                      {absence.status === "PARTIALLY_RESOLVED" && (
                        <Badge variant="default" className="text-xs">תוקן חלקית</Badge>
                      )}
                      <Link href={`/substitutions/${absence.id}`} className="ms-auto">
                        <button className="flex items-center gap-1 text-xs text-primary hover:underline">
                          טפל
                          <ChevronLeft className="h-3 w-3" />
                        </button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Today's absences */}
      {todayAbsences.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <UserMinus className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">היעדרויות היום</h3>
          </div>
          <div className="space-y-2">
            {todayAbsences.map((absence) => {
              const periods: number[] = JSON.parse(absence.periods);
              return (
                <Card key={absence.id}>
                  <CardContent className="py-2.5 px-4">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-sm">{absence.teacher.name}</span>
                      <span className="text-xs text-muted-foreground">{periods.length} שיעורים</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ms-auto ${
                        absence.status === "RESOLVED"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : absence.status === "PARTIALLY_RESOLVED"
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}>
                        {absence.status === "RESOLVED" ? "תוקן" : absence.status === "PARTIALLY_RESOLVED" ? "חלקי" : "לא תוקן"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Today's substitutions */}
      {todaySubstitutions.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">מילוי מקום היום</h3>
          </div>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-start px-3 py-2 font-medium text-muted-foreground text-xs">שיעור</th>
                  <th className="text-start px-3 py-2 font-medium text-muted-foreground text-xs">מורה נעדר</th>
                  <th className="text-start px-3 py-2 font-medium text-muted-foreground text-xs">פתרון</th>
                  <th className="text-start px-3 py-2 font-medium text-muted-foreground text-xs">מחליף</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Object.keys(subsByPeriod).sort((a, b) => Number(a) - Number(b)).flatMap(p =>
                  subsByPeriod[Number(p)].map((sub, i) => (
                    <tr key={sub.id} className="hover:bg-muted/30">
                      {i === 0 && (
                        <td className="px-3 py-2 font-medium" rowSpan={subsByPeriod[Number(p)].length}>
                          {PERIOD_LABELS[Number(p)] || `שיעור ${Number(p) + 1}`}
                        </td>
                      )}
                      <td className="px-3 py-2">{sub.absence.teacher.name}</td>
                      <td className="px-3 py-2">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted">
                          {SOLUTION_LABELS[sub.solutionType] || sub.solutionType}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {sub.substituteTeacher?.name || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
