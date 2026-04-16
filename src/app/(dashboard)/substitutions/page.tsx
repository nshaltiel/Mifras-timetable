import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, ChevronLeft } from "lucide-react";
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
          include: {
            substituteTeacher: { select: { name: true } },
          },
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

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "short" });
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">לוח שינויים</h2>

      {/* Today */}
      <section>
        <h3 className="text-lg font-semibold mb-3">
          היום —{" "}
          {new Date().toLocaleDateString("he-IL", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </h3>
        {todayAbsences.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <ArrowLeftRight className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>אין היעדרויות היום</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {todayAbsences.map((absence) => {
              const resolvedPeriods = absence.substitutions.map((s) => s.period);

              return (
                <Card key={absence.id}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{absence.teacher.name}</span>
                          <Badge
                            variant={
                              absence.status === "RESOLVED"
                                ? "secondary"
                                : absence.status === "PARTIALLY_RESOLVED"
                                ? "default"
                                : "destructive"
                            }
                            className="text-xs"
                          >
                            {absence.status === "RESOLVED"
                              ? "תוקן"
                              : absence.status === "PARTIALLY_RESOLVED"
                              ? "תוקן חלקית"
                              : "לא תוקן"}
                          </Badge>
                        </div>

                        {/* Substitution details by period — only show periods with actual lessons */}
                        <div className="space-y-1">
                          {absence.teachablePeriods.map((p) => {
                            const sub = absence.substitutions.find((s) => s.period === p);
                            return (
                              <div key={p} className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground min-w-[3.5rem]">
                                  {PERIOD_LABELS[p] || `שיעור ${p + 1}`}
                                </span>
                                {sub ? (
                                  <>
                                    <span
                                      className={`text-xs px-1.5 py-0.5 rounded-full
                                      ${sub.solutionType === "SUBSTITUTE_TEACHER"
                                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                        : sub.solutionType === "CANCEL_LESSON"
                                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                        : "bg-muted text-muted-foreground"
                                      }`}
                                    >
                                      {SOLUTION_LABELS[sub.solutionType] || sub.solutionType}
                                    </span>
                                    {sub.substituteTeacher && (
                                      <span className="text-muted-foreground">
                                        → {sub.substituteTeacher.name}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-destructive text-xs">לא תוקן</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <Link href={`/substitutions/${absence.id}`}>
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs shrink-0">
                          {resolvedPeriods.length < absence.teachablePeriods.length ? "טפל" : "צפה"}
                          <ChevronLeft className="h-3 w-3" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent 7 days */}
      {recentAbsences.filter((a) => a.date !== today).length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-3">7 ימים אחרונים</h3>
          <div className="space-y-2">
            {recentAbsences
              .filter((a) => a.date !== today)
              .map((absence) => {
                const periods: number[] = JSON.parse(absence.periods);
                return (
                  <Card key={absence.id}>
                    <CardContent className="py-2.5 px-4">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground min-w-[5rem]">
                          {formatDate(absence.date)}
                        </span>
                        <span className="font-medium text-sm">{absence.teacher.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {periods.length} שיעורים
                        </span>
                        <Badge
                          variant={
                            absence.status === "RESOLVED"
                              ? "secondary"
                              : absence.status === "PARTIALLY_RESOLVED"
                              ? "default"
                              : "destructive"
                          }
                          className="text-xs ms-auto"
                        >
                          {absence.status === "RESOLVED"
                            ? "תוקן"
                            : absence.status === "PARTIALLY_RESOLVED"
                            ? "חלקי"
                            : "לא תוקן"}
                        </Badge>
                        <Link href={`/substitutions/${absence.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </section>
      )}
    </div>
  );
}
