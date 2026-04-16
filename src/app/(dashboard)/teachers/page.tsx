import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createTeacher, deleteTeacher, updateTeacher } from "@/lib/actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TeacherDialog } from "./teacher-dialog";
import { DeleteButton } from "@/components/ui/delete-button";

export default async function TeachersPage() {
  const session = await auth();
  const schoolId = (session?.user as Record<string, unknown>)?.schoolId as string;

  const teachers = await prisma.teacher.findMany({
    where: { schoolId },
    include: {
      subjects: { include: { subject: true } },
      homeroomClass: true,
      _count: { select: { slots: true } },
    },
    orderBy: { name: "asc" },
  });

  const subjects = await prisma.subject.findMany({
    where: { schoolId },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">מורים</h2>
        <TeacherDialog
          subjects={subjects}
          action={createTeacher}
          title="הוספת מורה"
        />
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>שם</TableHead>
              <TableHead>אימייל</TableHead>
              <TableHead>טלפון</TableHead>
              <TableHead>מקצועות</TableHead>
              <TableHead>כיתת אם</TableHead>
              <TableHead>שעות מקסימום</TableHead>
              <TableHead>שיעורים</TableHead>
              <TableHead className="w-20">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teachers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  אין מורים עדיין. לחצו על &quot;הוספה&quot; כדי להתחיל.
                </TableCell>
              </TableRow>
            ) : (
              teachers.map((teacher) => (
                <TableRow key={teacher.id}>
                  <TableCell className="font-medium">{teacher.name}</TableCell>
                  <TableCell dir="ltr" className="text-start">
                    {teacher.email || "—"}
                  </TableCell>
                  <TableCell dir="ltr" className="text-start">
                    {teacher.phone || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {teacher.subjects.map((ts) => (
                        <Badge key={ts.id} variant="secondary" className="text-xs">
                          {ts.subject.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{teacher.homeroomClass?.name || "—"}</TableCell>
                  <TableCell>{teacher.maxHoursPerWeek ?? "—"}</TableCell>
                  <TableCell>{teacher._count.slots}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <TeacherDialog
                        subjects={subjects}
                        action={updateTeacher.bind(null, teacher.id)}
                        title="עריכת מורה"
                        defaultValues={{
                          name: teacher.name,
                          email: teacher.email || "",
                          phone: teacher.phone || "",
                          maxHoursPerWeek: teacher.maxHoursPerWeek?.toString() || "",
                        }}
                        isEdit
                      />
                      <DeleteButton
                        action={deleteTeacher.bind(null, teacher.id)}
                        entityName={teacher.name}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
