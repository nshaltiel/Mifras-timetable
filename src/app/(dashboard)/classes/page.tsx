import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createClass, deleteClass, updateClass } from "@/lib/actions";
import { PageHeader } from "@/components/ui/page-header";
import { EntityCard } from "@/components/ui/entity-card";
import { Chip } from "@/components/ui/mifras-chip";
import { ClassDialog } from "./class-dialog";
import { DeleteButton } from "@/components/ui/delete-button";
import { GRADE_HE } from "@/lib/constants";
import { GraduationCap } from "lucide-react";

export default async function ClassesPage() {
  const session = await auth();
  const schoolId = (session?.user as Record<string, unknown>)?.schoolId as string;

  const [classes, teachers, layers] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId },
      include: {
        homeroomTeacher: { select: { id: true, name: true } },
        layer: { select: { id: true, name: true } },
        _count: { select: { studyGroupLinks: true, requirements: true } },
      },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
    }),
    prisma.teacher.findMany({
      where: { schoolId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, homeroomClass: { select: { id: true } } },
    }),
    prisma.layer.findMany({
      where: { schoolId },
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // Group by grade
  const byGrade: Record<number, typeof classes> = {};
  for (const cls of classes) {
    if (!byGrade[cls.grade]) byGrade[cls.grade] = [];
    byGrade[cls.grade].push(cls);
  }
  const sortedGrades = Object.keys(byGrade).map(Number).sort((a, b) => a - b);

  const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);
  const layerCount = new Set(classes.map((c) => c.layerId).filter(Boolean)).size;

  // Build available homeroom teacher list per class (those without a homeroom class, + current class's teacher)
  const availableTeachers = teachers.filter((t) => !t.homeroomClass);

  const GRADE_COLORS = [
    "bg-mifras-orange-50", "bg-mifras-gold-50", "bg-mifras-sky-100",
    "bg-mifras-navy-50", "bg-emerald-50", "bg-purple-50",
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="כיתות"
        subtitle={`${classes.length} כיתות · ${layerCount} שכבות · ${totalStudents} תלמידים`}
        actions={
          <ClassDialog
            teachers={availableTeachers}
            layers={layers}
            action={createClass}
            title="הוספת כיתה"
          />
        }
      />

      {classes.length === 0 ? (
        <div className="text-center py-20 text-mifras-ink-400">
          <GraduationCap className="size-12 mx-auto mb-3 opacity-30" />
          <p className="text-[14px]">אין כיתות עדיין. לחצו על &quot;הוספת כיתה&quot; כדי להתחיל.</p>
        </div>
      ) : (
        <div className="space-y-7">
          {sortedGrades.map((grade) => {
            const gradeClasses = byGrade[grade];
            const gradeStudents = gradeClasses.reduce((s, c) => s + c.studentCount, 0);
            return (
              <div key={grade}>
                <div className="flex items-baseline gap-2 mb-3">
                  <h3
                    className="text-[17px] font-bold text-mifras-navy-700"
                    style={{ fontFamily: "var(--font-rubik), system-ui, sans-serif" }}
                  >
                    שכבה {GRADE_HE[grade] || grade}
                  </h3>
                  <span className="text-[13px] text-mifras-ink-400">
                    {gradeClasses.length} כיתות · {gradeStudents} תלמידים
                  </span>
                </div>
                <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
                  {gradeClasses.map((cls, idx) => {
                    const bgClass = GRADE_COLORS[grade % GRADE_COLORS.length] ?? "bg-mifras-navy-50";
                    const editTeachers = [
                      ...(cls.homeroomTeacher ? [{ id: cls.homeroomTeacher.id, name: cls.homeroomTeacher.name, homeroomClass: { id: cls.id } }] : []),
                      ...availableTeachers,
                    ];
                    return (
                      <EntityCard
                        key={cls.id}
                        avatar={
                          <div className={`size-10 rounded-full ${bgClass} text-mifras-navy-700 flex items-center justify-center text-[13px] font-bold shrink-0`}>
                            {cls.name.slice(0, 2)}
                          </div>
                        }
                        title={cls.name}
                        subtitle={
                          cls.homeroomTeacher
                            ? `מחנכת: ${cls.homeroomTeacher.name}`
                            : "ללא מחנך"
                        }
                        chips={
                          <div className="flex flex-wrap gap-1">
                            <Chip tone="sky">{cls.studentCount} תלמידים</Chip>
                            {cls.layer && <Chip tone="navy">{cls.layer.name}</Chip>}
                          </div>
                        }
                        stats={
                          <span>
                            {cls._count.requirements} מקצועות
                            {cls._count.studyGroupLinks > 0 && ` · ${cls._count.studyGroupLinks} הקבצות`}
                          </span>
                        }
                        actions={
                          <div className="flex gap-1">
                            <ClassDialog
                              teachers={editTeachers}
                              layers={layers}
                              action={updateClass.bind(null, cls.id)}
                              title="עריכת כיתה"
                              defaultValues={{
                                name: cls.name,
                                grade: cls.grade.toString(),
                                studentCount: cls.studentCount.toString(),
                                homeroomTeacherId: cls.homeroomTeacherId || "",
                                layerId: cls.layerId || "",
                              }}
                              isEdit
                            />
                            <DeleteButton action={deleteClass.bind(null, cls.id)} entityName={cls.name} />
                          </div>
                        }
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
