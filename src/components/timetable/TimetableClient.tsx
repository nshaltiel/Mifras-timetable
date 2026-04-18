"use client";

import { useEffect, useCallback, useState } from "react";
import { useTimetableStore } from "@/stores/timetable-store";
import { TimetableGrid } from "./TimetableGrid";
import { AddLessonDialog } from "./AddLessonDialog";
import { Button } from "@/components/ui/button";
import { Undo2, Redo2, Save, AlertTriangle } from "lucide-react";
import { saveTimetableBulk, loadSubstitutionsForDate } from "@/lib/timetable-actions";
import { AutoScheduleDialog } from "./AutoScheduleDialog";
import { toast } from "sonner";
import type { TimetableSlot } from "@/stores/timetable-store";
import { GRADE_HE } from "@/lib/constants";

type SubstitutionOverlay = Awaited<ReturnType<typeof loadSubstitutionsForDate>>[number];

// Compact class selector: grade tabs + class buttons for selected grade
function ClassSelector({
  classes,
  classesByGrade,
  selectedClassId,
  onClassChange,
}: {
  classes: { id: string; name: string; grade: number }[];
  classesByGrade: Record<number, { id: string; name: string; grade: number }[]>;
  selectedClassId: string | null;
  onClassChange: (id: string) => void;
}) {
  const grades = Object.keys(classesByGrade)
    .map(Number)
    .sort((a, b) => a - b);

  // Determine the active grade from selectedClassId
  const activeGrade = selectedClassId
    ? (classes.find((c) => c.id === selectedClassId)?.grade ?? grades[0])
    : null;

  const [filterGrade, setFilterGrade] = useState<number | null>(activeGrade ?? grades[0] ?? null);
  const gradeClasses = filterGrade ? (classesByGrade[filterGrade] ?? []) : [];

  return (
    <div className="flex items-center gap-3 pb-2 border-b border-border flex-wrap">
      {/* Grade pills */}
      <div className="flex gap-1 flex-wrap">
        <button
          onClick={() => { onClassChange(""); setFilterGrade(grades[0] ?? null); }}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            !selectedClassId ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          הכל
        </button>
        {grades.map((grade) => (
          <button
            key={grade}
            onClick={() => setFilterGrade(grade)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filterGrade === grade && selectedClassId
                ? "bg-primary/20 text-primary ring-1 ring-primary"
                : filterGrade === grade
                ? "bg-muted/80 text-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {GRADE_HE[grade] || grade}
          </button>
        ))}
      </div>

      {/* Divider */}
      {filterGrade && <span className="text-border">|</span>}

      {/* Class buttons for selected grade */}
      <div className="flex gap-1 flex-wrap">
        {gradeClasses.map((cls) => (
          <button
            key={cls.id}
            onClick={() => { onClassChange(cls.id); setFilterGrade(cls.grade); }}
            className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
              selectedClassId === cls.id
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            {cls.name}
          </button>
        ))}
      </div>
    </div>
  );
}

type StudyGroup = {
  id: string;
  name: string;
  subjectId: string;
  level: string | null;
  teacher: { id: string; name: string };
  subject: { id: string; name: string; color: string | null };
  classes: { classId: string }[];
};

interface TimetableClientProps {
  initialSlots: TimetableSlot[];
  teachers: { id: string; name: string; maxHoursPerWeek: number | null; subjects: { subject: { id: string; name: string; color: string | null } }[] }[];
  classes: { id: string; name: string; grade: number; studentCount: number }[];
  subjects: { id: string; name: string; color: string | null }[];
  rooms: { id: string; name: string; capacity: number }[];
  constraints: { teacherId: string; type: string; day: number | null; period: number | null }[];
  studyGroups: StudyGroup[];
  periodCount: number;
  periodTimes?: { start: string; end: string }[];
  selectedClassId: string | null;
  onClassChange: (classId: string) => void;
}

export function TimetableClient({
  initialSlots,
  teachers,
  classes,
  subjects,
  rooms,
  constraints,
  studyGroups,
  periodCount,
  periodTimes,
  selectedClassId,
  onClassChange,
}: TimetableClientProps) {
  const { setSlots, setConstraints, undo, redo, isDirty, pendingConflicts, history, historyIndex, markSaved, slots } =
    useTimetableStore();

  const todayStr = new Date().toISOString().slice(0, 10);
  const [actualView, setActualView] = useState(false);
  const [viewDate, setViewDate] = useState(todayStr);
  const [overlays, setOverlays] = useState<SubstitutionOverlay[]>([]);

  useEffect(() => {
    setSlots(initialSlots);
    setConstraints(
      constraints.map((c) => ({ ...c, day: c.day ?? undefined, period: c.period ?? undefined }))
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!actualView) { setOverlays([]); return; }
    loadSubstitutionsForDate(viewDate).then(setOverlays).catch(() => setOverlays([]));
  }, [actualView, viewDate]);

  const conflictCount = Object.keys(pendingConflicts).length;

  const classNames: Record<string, string> = {};
  for (const cls of classes) classNames[cls.id] = cls.name;

  const handleSave = useCallback(async () => {
    const result = await saveTimetableBulk(
      slots.map((s) => ({
        id: s.id,
        day: s.day,
        period: s.period,
        classId: s.classId,
        teacherId: s.teacherId,
        subjectId: s.subjectId,
        roomId: s.roomId,
        studyGroupId: s.studyGroupId,
      }))
    );
    if (result.success) {
      markSaved();
      toast.success("מערכת השעות נשמרה בהצלחה");
    }
  }, [slots, markSaved]);

  // Keyboard undo/redo
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  // Group classes by grade
  const classesByGrade = classes.reduce<Record<number, typeof classes>>((acc, cls) => {
    acc[cls.grade] = acc[cls.grade] || [];
    acc[cls.grade].push(cls);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={undo}
            disabled={historyIndex <= 0}
            title="ביטול (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            title="חזרה (Ctrl+Y)"
          >
            <Redo2 className="h-4 w-4" />
          </Button>

          {conflictCount > 0 && (
            <div className="flex items-center gap-1 text-destructive text-sm bg-destructive/10 rounded px-2 py-1">
              <AlertTriangle className="h-4 w-4" />
              <span>{conflictCount} קונפליקטים</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Actual view toggle */}
          <div className="flex items-center gap-1 border rounded-lg p-0.5">
            <button
              onClick={() => setActualView(false)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${!actualView ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              מתוכנן
            </button>
            <button
              onClick={() => setActualView(true)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${actualView ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              בפועל
            </button>
          </div>
          {actualView && (
            <input
              type="date"
              value={viewDate}
              onChange={(e) => setViewDate(e.target.value)}
              className="h-7 rounded-md border border-input bg-transparent px-2 text-xs"
              dir="ltr"
            />
          )}
          {!actualView && (
            <>
              <AutoScheduleDialog
                classes={classes}
                subjects={subjects}
                selectedClassId={selectedClassId}
              />
              <AddLessonDialog
                teachers={teachers}
                classes={classes}
                rooms={rooms}
                subjects={subjects}
                studyGroups={studyGroups}
                teacherConstraints={constraints}
                periodCount={periodCount}
                periodTimes={periodTimes}
                defaultClassId={selectedClassId ?? undefined}
              />
              <Button
                onClick={handleSave}
                disabled={!isDirty}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {isDirty ? "שמירה*" : "שמור"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Class selector */}
      <ClassSelector
        classes={classes}
        classesByGrade={classesByGrade}
        selectedClassId={selectedClassId}
        onClassChange={onClassChange}
      />

      {/* Grid */}
      <div className="flex-1 overflow-auto border rounded-lg">
        <TimetableGrid
          classIds={classes.map((c) => c.id)}
          classNames={classNames}
          periodCount={periodCount}
          viewMode="by-class"
          filterClassId={selectedClassId ?? undefined}
          substitutionOverlays={actualView ? overlays : []}
          teachers={teachers}
          subjects={subjects}
          rooms={rooms}
          classes={classes}
          studyGroups={studyGroups}
          teacherConstraints={constraints}
          periodTimes={periodTimes}
        />
      </div>
    </div>
  );
}
