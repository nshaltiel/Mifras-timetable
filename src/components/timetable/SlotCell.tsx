"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { LessonCard } from "./LessonCard";
import type { TimetableSlot } from "@/stores/timetable-store";
import type { Conflict } from "@/engine/conflict-detector";

type SubstitutionOverlay = {
  solutionType: string;
  substituteTeacherName?: string;
  originalTeacherName: string;
};

const SOLUTION_LABELS: Record<string, string> = {
  SUBSTITUTE_TEACHER: "מחליף",
  CANCEL_LESSON: "בוטל",
  MERGE_CLASSES: "מיזוג",
  TIME_SWAP: "החלפה",
  DISSOLVE_STUDY_GROUP: "פירוק",
  DISTRIBUTE_TO_HOMEROOM: "עצמי",
  SELF_STUDY: "עצמי",
};

interface SlotCellProps {
  day: number;
  period: number;
  classId: string;
  slot?: TimetableSlot;
  conflicts?: Conflict[];
  onRemove?: () => void;
  onEdit?: () => void;
  substitution?: SubstitutionOverlay;
}

export function SlotCell({ day, period, classId, slot, conflicts, onRemove, onEdit, substitution }: SlotCellProps) {
  const droppableId = `drop-${day}-${period}-${classId}`;

  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { day, period, classId },
  });

  const hasConflict = conflicts && conflicts.length > 0;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[60px] p-1 border-b border-s border-border relative transition-colors",
        isOver && "bg-primary/10",
        !slot && isOver && "bg-primary/20",
        hasConflict && "bg-destructive/5",
        substitution && "bg-amber-50/50 dark:bg-amber-900/10"
      )}
    >
      {slot ? (
        <LessonCard
          slot={slot}
          hasConflict={hasConflict}
          onRemove={onRemove}
          onEdit={onEdit}
        />
      ) : (
        <div className={cn(
          "h-full w-full rounded-sm min-h-[52px]",
          isOver && "border-2 border-dashed border-primary"
        )} />
      )}
      {hasConflict && (
        <div className="absolute top-0.5 left-0.5 w-2 h-2 rounded-full bg-destructive" title={conflicts[0].message} />
      )}
      {substitution && (
        <div className="absolute bottom-0.5 inset-x-0.5 rounded text-[10px] leading-tight px-1 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 truncate">
          {substitution.solutionType === "SUBSTITUTE_TEACHER" && substitution.substituteTeacherName
            ? `↔ ${substitution.substituteTeacherName}`
            : SOLUTION_LABELS[substitution.solutionType] ?? substitution.solutionType}
        </div>
      )}
    </div>
  );
}
