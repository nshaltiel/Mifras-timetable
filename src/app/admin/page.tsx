import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { AlertTriangle, Building2, Users, ChevronLeft } from "lucide-react";

export default async function AdminPage() {
  const schools = await prisma.school.findMany({
    include: {
      users: { select: { id: true, name: true, email: true, role: true, createdAt: true } },
      _count: { select: { teachers: true, classes: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Get last activity per school (latest absence or substitution)
  const schoolActivity = await Promise.all(
    schools.map(async (school) => {
      const latestAbsence = await prisma.absence.findFirst({
        where: { teacher: { schoolId: school.id } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      const latestSub = await prisma.substitution.findFirst({
        where: { absence: { teacher: { schoolId: school.id } } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });

      const dates = [
        latestAbsence?.createdAt,
        latestSub?.createdAt,
        school.updatedAt,
      ].filter(Boolean) as Date[];

      const lastActivity =
        dates.length > 0
          ? new Date(Math.max(...dates.map((d) => d.getTime())))
          : school.createdAt;

      return { schoolId: school.id, lastActivity };
    })
  );

  const activityMap = Object.fromEntries(
    schoolActivity.map((a) => [a.schoolId, a.lastActivity])
  );
  const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  function formatDate(d: Date) {
    return d.toLocaleDateString("he-IL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function daysSince(d: Date) {
    return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  }

  const inactiveSchools = schools.filter((s) => activityMap[s.id] < twoMonthsAgo);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">בתי ספר ({schools.length})</h1>
        <Link href="/admin/schools/new">
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90">
            + פתיחת בית ספר חדש
          </button>
        </Link>
      </div>

      {inactiveSchools.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-700">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800 dark:text-yellow-400">
                {inactiveSchools.length} בתי ספר לא פעילים מעל חודשיים:
              </span>
              <span className="text-sm text-yellow-700 dark:text-yellow-500">
                {inactiveSchools.map((s) => s.name).join(", ")}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {schools.map((school) => {
          const lastActivity = activityMap[school.id];
          const inactive = lastActivity < twoMonthsAgo;
          const days = daysSince(lastActivity);

          return (
            <Card key={school.id} className={inactive ? "border-yellow-300/60" : ""}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{school.name}</span>
                      {inactive && (
                        <Badge
                          variant="outline"
                          className="text-xs border-yellow-400 text-yellow-700"
                        >
                          לא פעיל {days} ימים
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      {school.principalName && (
                        <span>מנהל: {school.principalName}</span>
                      )}
                      <span>{school._count.teachers} מורים</span>
                      <span>{school._count.classes} כיתות</span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {school.users.length} משתמשים
                      </span>
                      <span>פעיל לאחרונה: {formatDate(lastActivity)}</span>
                    </div>
                  </div>
                  <Link href={`/admin/schools/${school.id}`}>
                    <button className="flex items-center gap-1 text-sm text-primary hover:underline">
                      נהל
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {schools.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p>אין בתי ספר רשומים עדיין.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
