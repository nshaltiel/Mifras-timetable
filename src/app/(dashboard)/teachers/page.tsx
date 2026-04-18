import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createTeacher, deleteTeacher, updateTeacher } from "@/lib/actions";
import { PageHeader } from "@/components/ui/page-header";
import { EntityCard } from "@/components/ui/entity-card";
import { Chip } from "@/components/ui/mifras-chip";
import { TeacherDialog } from "./teacher-dialog";
import { DeleteButton } from "@/components/ui/delete-button";
import { Button } from "@/components/ui/button";
import { Upload, Users } from "lucide-react";

export default async function TeachersPage() {
  const session = await auth();
  const schoolId = (session?.user as Record<string, unknown>)?.schoolId as string;

  const [teachers, subjects, classes] = await Promise.all([
    prisma.teacher.findMany({
      where: { schoolId },
      include: {
        subjects: { include: { subject: { select: { id: true, name: true, color: true } } } },
        homeroomClass: { select: { id: true, name: true } },
        excludedClasses: { include: { class: { select: { id: true, name: true, grade: true } } } },
        _count: { select: { slots: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.subject.findMany({ where: { schoolId }, orderBy: { name: "asc" } }),
    prisma.class.findMany({
      where: { schoolId },
      select: { id: true, name: true, grade: true },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="מורים"
        subtitle={`${teachers.length} מורים`}
        actions={
          <>
            <Button variant="outline" className="gap-1.5">
              <Upload className="size-3.5" />
              ייבוא מאקסל
            </Button>
            <TeacherDialog
              subjects={subjects}
              allClasses={classes}
              action={createTeacher}
              title="הוספת מורה"
            />
          </>
        }
      />

      {teachers.length === 0 ? (
        <div className="text-center py-20 text-mifras-ink-400">
          <Users className="size-12 mx-auto mb-3 opacity-30" />
          <p className="text-[14px]">אין מורים עדיין. לחצו על &quot;הוספת מורה&quot; כדי להתחיל.</p>
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {teachers.map((teacher) => {
            const initials = teacher.name.slice(0, 2);
            const subjectNames = teacher.subjects.map((ts) => ts.subject.name);

            return (
              <EntityCard
                key={teacher.id}
                avatar={
                  <div className="size-10 rounded-full bg-mifras-navy-50 text-mifras-navy-700 flex items-center justify-center text-[14px] font-bold shrink-0">
                    {initials}
                  </div>
                }
                title={teacher.name}
                subtitle={
                  teacher.maxHoursPerWeek
                    ? `מקסימום ${teacher.maxHoursPerWeek} שעות/שבוע`
                    : teacher.homeroomClass
                    ? `מחנך/ת: ${teacher.homeroomClass.name}`
                    : undefined
                }
                chips={
                  <div className="flex flex-wrap gap-1">
                    {subjectNames.slice(0, 3).map((name) => (
                      <Chip key={name} tone="navy">{name}</Chip>
                    ))}
                    {subjectNames.length > 3 && (
                      <Chip tone="ghost">+{subjectNames.length - 3}</Chip>
                    )}
                  </div>
                }
                stats={
                  <div className="flex items-center gap-3">
                    <span>{teacher._count.slots} שעות שבועיות</span>
                    {teacher.homeroomClass && (
                      <span>כיתת אם: {teacher.homeroomClass.name}</span>
                    )}
                  </div>
                }
                actions={
                  <div className="flex gap-1">
                    <TeacherDialog
                      subjects={subjects}
                      allClasses={classes}
                      action={updateTeacher.bind(null, teacher.id)}
                      title="עריכת מורה"
                      defaultValues={{
                        name: teacher.name,
                        email: teacher.email || "",
                        phone: teacher.phone || "",
                        maxHoursPerWeek: teacher.maxHoursPerWeek?.toString() || "",
                        subjectIds: teacher.subjects.map((ts) => ts.subjectId),
                        excludedClassIds: teacher.excludedClasses.map((e) => e.classId),
                      }}
                      isEdit
                    />
                    <DeleteButton action={deleteTeacher.bind(null, teacher.id)} entityName={teacher.name} />
                  </div>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
