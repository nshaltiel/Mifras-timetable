"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Class {
  id: string;
  name: string;
  grade: number;
}

interface Subject {
  id: string;
  name: string;
  color: string | null;
}

interface CellData {
  teacherId: string;
  teacherName: string;
  hours: number;
}

interface HoursPlanningClientProps {
  classes: Class[];
  subjects: Subject[];
  summary: Record<string, Record<string, CellData>>;
}

const GRADE_NAMES: Record<number, string> = {
  7: "ז'",
  8: "ח'",
  9: "ט'",
  10: "י'",
  11: 'י"א',
  12: 'י"ב',
};

export function HoursPlanningClient({
  classes,
  subjects,
  summary,
}: HoursPlanningClientProps) {
  const grades = [...new Set(classes.map((c) => c.grade))].sort((a, b) => a - b);
  const [selectedGrade, setSelectedGrade] = useState<number>(grades[0] ?? 7);

  const gradeClasses = classes.filter((c) => c.grade === selectedGrade);

  // Filter subjects that have at least one slot in this grade's classes
  const gradeClassIds = new Set(gradeClasses.map((c) => c.id));
  const activeSubjectIds = new Set<string>();
  for (const classId of gradeClassIds) {
    const classSummary = summary[classId];
    if (classSummary) {
      for (const subjectId of Object.keys(classSummary)) {
        activeSubjectIds.add(subjectId);
      }
    }
  }

  // Show all subjects, but highlight ones with data
  const displaySubjects = subjects.filter(
    (s) => activeSubjectIds.has(s.id) || gradeClasses.some((c) => summary[c.id]?.[s.id])
  );

  return (
    <div className="flex flex-col gap-4 flex-1 overflow-hidden">
      {/* Grade tabs */}
      <div className="flex gap-1 border-b border-border pb-2">
        {grades.map((grade) => (
          <Button
            key={grade}
            variant={selectedGrade === grade ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedGrade(grade)}
          >
            כיתות {GRADE_NAMES[grade] || grade}
          </Button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto border rounded-lg">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-background z-10">
            <tr>
              <th className="border border-border px-3 py-2 text-start bg-muted/50 min-w-[140px] font-medium">
                מקצוע
              </th>
              {gradeClasses.map((cls) => (
                <th
                  key={cls.id}
                  className="border border-border px-3 py-2 text-center bg-muted/50 min-w-[120px] font-medium"
                >
                  {cls.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displaySubjects.length === 0 ? (
              <tr>
                <td
                  colSpan={gradeClasses.length + 1}
                  className="text-center py-8 text-muted-foreground border border-border"
                >
                  אין נתונים לכיתות אלה. בנה מערכת שעות כדי לראות סיכום כאן.
                </td>
              </tr>
            ) : (
              displaySubjects.map((subject) => (
                <tr key={subject.id} className="hover:bg-muted/30">
                  <td className="border border-border px-3 py-2 font-medium">
                    <div className="flex items-center gap-2">
                      {subject.color && (
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: subject.color }}
                        />
                      )}
                      {subject.name}
                    </div>
                  </td>
                  {gradeClasses.map((cls) => {
                    const cell = summary[cls.id]?.[subject.id];
                    return (
                      <td
                        key={cls.id}
                        className="border border-border px-2 py-1 text-center align-middle"
                      >
                        {cell ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-medium text-xs leading-tight">
                              {cell.teacherName}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {cell.hours} ש׳/שבוע
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/40 text-xs">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="text-xs text-muted-foreground">
        * הטבלה מסכמת שיעורים קיימים במערכת השעות. לשינוי הקצאות, ערוך את מערכת השעות.
      </div>
    </div>
  );
}
