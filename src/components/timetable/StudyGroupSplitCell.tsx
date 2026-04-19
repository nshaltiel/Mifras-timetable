"use client";

import { useDroppable } from "@dnd-kit/core";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimetableSlot } from "@/stores/timetable-store";
import type { Conflict } from "@/engine/conflict-detector";

interface StudyGroupSplitCellProps {
  day: number;
  period: number;
  classId: string;
  /** The slot belonging to this cell's class */
  ownSlot: TimetableSlot;
  /** All concurrent study group slots at this (day, period) for the same grade + subject */
  allSlots: TimetableSlot[];
  conflicts?: Conflict[];
  onRemove?: () => void;
  onEdit?: () => void;
}

export function StudyGroupSplitCell({
  day,
  period,
  classId,
  ownSlot,
  allSlots,
  conflicts,
  onRemove,
  onEdit,
}: StudyGroupSplitCellProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-${day}-${period}-${classId}`,
    data: { day, period, classId },
  });

  const hasConflict = conflicts && conflicts.length > 0;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[60px] p-1 border-b border-s border-border relative transition-colors",
        isOver && "bg-primary/10",
        hasConflict && "bg-destructive/5"
      )}
    >
      {/* Subject name — shared header for all groups */}
      <div
        className="text-[10px] font-semibold mb-0.5 truncate"
        style={{ color: ownSlot.subjectColor }}
      >
        {ownSlot.subjectName}
      </div>

      {/* One mini-card per study group, split horizontally */}
      <div className="flex gap-0.5">
        {allSlots.map((s) => {
          const isOwn = s.classId === classId;
          return (
            <div
              key={s.classId}
              className={cn(
                "flex-1 rounded border p-0.5 text-[9px] leading-tight min-w-0",
                isOwn ? "border-2" : "border opacity-55 bg-muted/30"
              )}
              style={
                isOwn
                  ? { borderColor: s.subjectColor, backgroundColor: s.subjectColor + "22" }
                  : {}
              }
            >
              <div className="font-medium truncate">{s.teacherName}</div>
              {s.roomName && (
                <div className="text-muted-foreground/70 truncate">{s.roomName}</div>
              )}
              {isOwn && (onEdit || onRemove) && (
                <div className="flex gap-0.5 mt-0.5">
                  {onEdit && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onEdit(); }}
                      className="text-muted-foreground hover:text-primary leading-none w-4 h-4 flex items-center justify-center rounded hover:bg-primary/10"
                      title="עריכה"
                    >
                      <Pencil className="h-2.5 w-2.5" />
                    </button>
                  )}
                  {onRemove && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemove(); }}
                      className="text-muted-foreground hover:text-destructive leading-none w-4 h-4 flex items-center justify-center rounded hover:bg-destructive/10"
                      title="הסרה"
                    >
                      ×
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hasConflict && (
        <div className="mt-0.5 rounded text-[10px] leading-tight px-1 py-0.5 bg-destructive/15 text-destructive font-medium line-clamp-2">
          ⚠ {conflicts!.map((c) => c.message).join(" | ")}
        </div>
      )}
    </div>
  );
}
