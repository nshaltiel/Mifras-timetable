import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createClass, deleteClass, updateClass } from "@/lib/actions";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { GRADE_HE } from "@/lib/constants";
import { ClassDialog } from "./class-dialog";
import { DeleteButton } from "@/components/ui/delete-button";

export default async function ClassesPage() {
  const session = await auth();
  const schoolId = (session?.user as Record<string, unknown>)?.schoolId as string;

  const [classes, teachers] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId },
      include: { homeroomTeacher: true },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
    }),
    prisma.teacher.findMany({
      where: { schoolId, homeroomClass: null },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">כיתות</h2>
        <ClassDialog
          teachers={teachers}
          action={createClass}
          title="הוספת כיתה"
        />
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>שם כיתה</TableHead>
              <TableHead>שכבה</TableHead>
              <TableHead>מספר תלמידים</TableHead>
              <TableHead>מחנך/ת</TableHead>
              <TableHead className="w-20">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  אין כיתות עדיין. לחצו על &quot;הוספה&quot; כדי להתחיל.
                </TableCell>
              </TableRow>
            ) : (
              classes.map((cls) => (
                <TableRow key={cls.id}>
                  <TableCell className="font-medium">{cls.name}</TableCell>
                  <TableCell>{GRADE_HE[cls.grade] || cls.grade}</TableCell>
                  <TableCell>{cls.studentCount}</TableCell>
                  <TableCell>{cls.homeroomTeacher?.name || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <ClassDialog
                        teachers={[
                          ...(cls.homeroomTeacher ? [cls.homeroomTeacher] : []),
                          ...teachers,
                        ]}
                        action={updateClass.bind(null, cls.id)}
                        title="עריכת כיתה"
                        defaultValues={{
                          name: cls.name,
                          grade: cls.grade.toString(),
                          studentCount: cls.studentCount.toString(),
                          homeroomTeacherId: cls.homeroomTeacherId || "",
                        }}
                        isEdit
                      />
                      <DeleteButton
                        action={deleteClass.bind(null, cls.id)}
                        entityName={cls.name}
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
