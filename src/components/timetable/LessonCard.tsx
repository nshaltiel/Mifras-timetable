"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";
import type { TimetableSlot } from "@/stores/timetable-store";

interface LessonCardProps {
  slot: TimetableSlot;
  compact?: boolean;
  hasConflict?: boolean;
  onRemove?: () => void;
  onEdit?: () => void;
}

export function LessonCard({ slot, compact, hasConflict, onRemove, onEdit }: LessonCardProps) {
  const dragId = `${slot.day}-${slot.period}-${slot.classId}`;

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: dragId, data: { slot } });

  const style = {
    transform: CSS.Translate.toString(transform),
    backgroundColor: slot.subjectColor + "22",
    borderColor: slot.subjectColor,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "relative rounded-md border-2 p-1.5 cursor-grab select-none text-xs leading-tight",
        "transition-shadow hover:shadow-md active:cursor-grabbing",
        hasConflict && "border-destructive bg-destructive/10 animate-pulse",
        isDragging && "z-50 shadow-lg"
      )}
    >
      <div
        className="font-semibold truncate"
        style={{ color: slot.subjectColor }}
      >
        {slot.subjectName}
      </div>
      {!compact && (
        <>
          <div className="text-muted-foreground truncate">{slot.teacherName}</div>
          {slot.roomName && (
            <div className="text-muted-foreground/70 truncate">{slot.roomName}</div>
          )}
        </>
      )}
      {/* Action buttons */}
      {!compact && (onRemove || onEdit) && (
        <div className="absolute top-0.5 left-0.5 flex gap-0.5">
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="text-muted-foreground hover:text-primary text-xs leading-none w-4 h-4 flex items-center justify-center rounded hover:bg-primary/10"
              title="עריכה"
            >
              <Pencil className="h-2.5 w-2.5" />
            </button>
          )}
          {onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="text-muted-foreground hover:text-destructive text-xs leading-none w-4 h-4 flex items-center justify-center rounded hover:bg-destructive/10"
              title="הסרה"
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}
