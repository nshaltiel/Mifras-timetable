"use client";

import { useDroppable } from "@dnd-kit/core";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimetableSlot } from "@/stores/timetable-store";
import type { Conflict } from "@/engine/conflict-detector";

interface SplitPeriodCellProps {
  day: number;
  period: number;
  classId: string;
  slots: [TimetableSlot, TimetableSlot];
  conflicts?: Conflict[];
  onRemoveHalf: (slot: TimetableSlot) => void;
  onEdit: (slot: TimetableSlot) => void;
}

export function SplitPeriodCell({
  day,
  period,
  classId,
  slots,
  conflicts,
  onRemoveHalf,
  onEdit,
}: SplitPeriodCellProps) {
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
      <div className="text-[9px] text-muted-foreground font-medium mb-0.5">פיצול שעה</div>

      <div className="flex gap-0.5">
        {slots.map((s, idx) => (
          <div
            key={s.id ?? idx}
            className="flex-1 rounded border-2 p-0.5 text-[9px] leading-tight min-w-0"
            style={{ borderColor: s.subjectColor, backgroundColor: s.subjectColor + "22" }}
          >
            <div className="font-semibold truncate" style={{ color: s.subjectColor }}>
              {s.subjectName}
            </div>
            <div className="text-muted-foreground truncate">{s.teacherName}</div>
            {s.roomName && (
              <div className="text-muted-foreground/70 truncate">{s.roomName}</div>
            )}
            <div className="flex gap-0.5 mt-0.5">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(s); }}
                className="text-muted-foreground hover:text-primary leading-none w-4 h-4 flex items-center justify-center rounded hover:bg-primary/10"
                title="עריכה"
              >
                <Pencil className="h-2.5 w-2.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onRemoveHalf(s); }}
                className="text-muted-foreground hover:text-destructive leading-none w-4 h-4 flex items-center justify-center rounded hover:bg-destructive/10"
                title="הסרת חצי"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {hasConflict && (
        <div className="mt-0.5 rounded text-[10px] leading-tight px-1 py-0.5 bg-destructive/15 text-destructive font-medium line-clamp-2">
          ⚠ {conflicts!.map((c) => c.message).join(" | ")}
        </div>
      )}
    </div>
  );
}
