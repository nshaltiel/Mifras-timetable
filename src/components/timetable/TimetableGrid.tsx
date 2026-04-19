"use client";

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useState } from "react";
import { useTimetableStore, type TimetableSlot } from "@/stores/timetable-store";
import { SlotCell } from "./SlotCell";
import { LessonCard } from "./LessonCard";
import { AddLessonDialog } from "./AddLessonDialog";
import { DAYS_HE, PERIOD_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type SubstitutionOverlay = {
  day: number;
  period: number;
  classId: string;
  solutionType: string;
  substituteTeacherName?: string;
  originalTeacherName: string;
};

type TeacherInfo = { id: string; name: string; maxHoursPerWeek: number | null; subjects: { subject: { id: string; name: string; color: string | null } }[] };
type SubjectInfo = { id: string; name: string; color: string | null };
type RoomInfo = { id: string; name: string; capacity: number };
type ClassInfo = {
  id: string;
  name: string;
  grade: number;
  studentCount: number;
  homeroomTeacherId?: string | null;
  layerAllowedRoomIds?: string[] | null;
  excludedTeacherIds?: string[];
};
type StudyGroupInfo = { id: string; name: string; subjectId: string; level: string | null; teacher: { id: string; name: string }; subject: { id: string; name: string; color: string | null }; classes: { classId: string }[] };

interface TimetableGridProps {
  classIds: string[];
  classNames: Record<string, string>; // id -> name
  periodCount: number;
  dayCount?: number;
  viewMode?: "by-class" | "by-teacher" | "by-room";
  filterClassId?: string;
  filterTeacherId?: string;
  filterRoomId?: string;
  substitutionOverlays?: SubstitutionOverlay[];
  periodTimes?: { start: string; end: string }[];
  // For edit dialog
  teachers?: TeacherInfo[];
  subjects?: SubjectInfo[];
  rooms?: RoomInfo[];
  classes?: ClassInfo[];
  studyGroups?: StudyGroupInfo[];
  teacherConstraints?: { teacherId: string; type: string; day: number | null; period: number | null }[];
}

export function TimetableGrid({
  classIds,
  classNames,
  periodCount,
  dayCount = 6,
  viewMode = "by-class",
  filterClassId,
  filterTeacherId,
  filterRoomId,
  substitutionOverlays = [],
  periodTimes = [],
  teachers = [],
  subjects = [],
  rooms = [],
  classes = [],
  studyGroups = [],
  teacherConstraints = [],
}: TimetableGridProps) {
  const { slots, pendingConflicts, moveSlot, removeSlot } = useTimetableStore();
  const [activeSlot, setActiveSlot] = useState<TimetableSlot | null>(null);
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as { slot: TimetableSlot };
    setActiveSlot(data.slot);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveSlot(null);
    const { active, over } = event;
    if (!over) return;

    const src = active.data.current as { slot: TimetableSlot };
    const dst = over.data.current as { day: number; period: number; classId: string };
    if (!src || !dst) return;

    const from = src.slot;
    if (from.day === dst.day && from.period === dst.period && from.classId === dst.classId) return;

    moveSlot(from.day, from.period, from.classId, dst.day, dst.period, dst.classId);
  }

  // Build lookup maps
  const slotMap: Record<string, TimetableSlot> = {};
  const teacherSlotMap: Record<string, TimetableSlot> = {};
  const roomSlotMap: Record<string, TimetableSlot> = {};
  for (const slot of slots) {
    slotMap[`${slot.day}-${slot.period}-${slot.classId}`] = slot;
    teacherSlotMap[`${slot.day}-${slot.period}-${slot.teacherId}`] = slot;
    if (slot.roomId) roomSlotMap[`${slot.day}-${slot.period}-${slot.roomId}`] = slot;
  }

  // Entities present in slots (for "all" stacked views)
  const teachersWithSlots = teachers.filter((t) => slots.some((s) => s.teacherId === t.id));
  const roomsWithSlots = rooms.filter((r) => slots.some((s) => s.roomId === r.id));

  // Build overlay map
  const overlayMap: Record<string, SubstitutionOverlay> = {};
  for (const ov of substitutionOverlays) {
    overlayMap[`${ov.day}-${ov.period}-${ov.classId}`] = ov;
  }

  const displayClassIds = filterClassId ? [filterClassId] : classIds;
  const days = Array.from({ length: dayCount }, (_, i) => i);
  const periods = Array.from({ length: periodCount }, (_, i) => i);

  function getPeriodLabel(i: number) {
    const t = periodTimes[i];
    if (t?.start && t?.end) return `${t.start}–${t.end}`;
    if (t?.start) return t.start;
    return PERIOD_LABELS[i];
  }

  function ReadonlyCell({
    slot,
    viewContext,
  }: {
    slot?: TimetableSlot;
    viewContext: "teacher" | "room";
  }) {
    return (
      <div className="min-h-[60px] p-1 border-b border-s border-border relative">
        {slot ? (
          <LessonCard
            slot={slot}
            viewContext={viewContext}
            onEdit={() => setEditingSlot(slot)}
            onRemove={() => removeSlot(slot.day, slot.period, slot.classId)}
          />
        ) : (
          <div className="min-h-[52px]" />
        )}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* Edit dialog — only rendered when editing */}
      {editingSlot && teachers.length > 0 && (
        <AddLessonDialog
          teachers={teachers}
          classes={classes}
          rooms={rooms}
          subjects={subjects}
          studyGroups={studyGroups}
          teacherConstraints={teacherConstraints}
          periodCount={periodCount}
          dayCount={dayCount}
          periodTimes={periodTimes}
          defaultClassId={editingSlot.classId}
          defaultDay={editingSlot.day}
          defaultPeriod={editingSlot.period}
          editingSlot={editingSlot}
          onClose={() => setEditingSlot(null)}
          forceOpen
        />
      )}
      <div className="overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {/* Period label column */}
              <th className="w-20 border border-border bg-muted/50 p-2 text-center text-xs font-medium text-muted-foreground sticky end-0 z-10">
                שעה
              </th>
              {/* Day columns */}
              {days.map((day) => (
                <th
                  key={day}
                  className="border border-border bg-muted/50 p-2 text-center text-xs font-medium min-w-[80px]"
                >
                  {DAYS_HE[day]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* If single class view: one row per period */}
            {viewMode === "by-class" && filterClassId ? (
              periods.map((period) => (
                <tr key={period}>
                  <td className="border border-border bg-muted/30 p-1 text-center text-xs text-muted-foreground font-medium sticky end-0 z-10">
                    {getPeriodLabel(period)}
                  </td>
                  {days.map((day) => {
                    const key = `${day}-${period}-${filterClassId}`;
                    return (
                      <td key={day} className="border-0 p-0">
                        <SlotCell
                          day={day}
                          period={period}
                          classId={filterClassId}
                          slot={slotMap[key]}
                          conflicts={pendingConflicts[key]}
                          onRemove={slotMap[key] ? () => removeSlot(day, period, filterClassId) : undefined}
                          onEdit={slotMap[key] ? () => setEditingSlot(slotMap[key]) : undefined}
                          substitution={overlayMap[key]}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : viewMode === "by-teacher" && filterTeacherId ? (
              /* Single-teacher view: one row per period */
              periods.map((period) => (
                <tr key={period}>
                  <td className="border border-border bg-muted/30 p-1 text-center text-xs text-muted-foreground font-medium sticky end-0 z-10">
                    {getPeriodLabel(period)}
                  </td>
                  {days.map((day) => (
                    <td key={day} className="border-0 p-0">
                      <ReadonlyCell
                        slot={teacherSlotMap[`${day}-${period}-${filterTeacherId}`]}
                        viewContext="teacher"
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : viewMode === "by-teacher" ? (
              /* All teachers stacked */
              teachersWithSlots.flatMap((teacher) =>
                periods.map((period) => {
                  const isFirstPeriod = period === 0;
                  return (
                    <tr key={`${teacher.id}-${period}`} className={cn(isFirstPeriod && "border-t-2 border-border")}>
                      {isFirstPeriod && (
                        <td
                          rowSpan={periodCount}
                          className="border border-border bg-primary/5 p-2 text-center text-xs font-bold w-20 sticky end-0 z-10 whitespace-nowrap"
                        >
                          {teacher.name}
                        </td>
                      )}
                      {days.map((day) => (
                        <td key={day} className="border-0 p-0">
                          <ReadonlyCell
                            slot={teacherSlotMap[`${day}-${period}-${teacher.id}`]}
                            viewContext="teacher"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })
              )
            ) : viewMode === "by-room" && filterRoomId ? (
              /* Single-room view: one row per period */
              periods.map((period) => (
                <tr key={period}>
                  <td className="border border-border bg-muted/30 p-1 text-center text-xs text-muted-foreground font-medium sticky end-0 z-10">
                    {getPeriodLabel(period)}
                  </td>
                  {days.map((day) => (
                    <td key={day} className="border-0 p-0">
                      <ReadonlyCell
                        slot={roomSlotMap[`${day}-${period}-${filterRoomId}`]}
                        viewContext="room"
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : viewMode === "by-room" ? (
              /* All rooms stacked */
              roomsWithSlots.flatMap((room) =>
                periods.map((period) => {
                  const isFirstPeriod = period === 0;
                  return (
                    <tr key={`${room.id}-${period}`} className={cn(isFirstPeriod && "border-t-2 border-border")}>
                      {isFirstPeriod && (
                        <td
                          rowSpan={periodCount}
                          className="border border-border bg-primary/5 p-2 text-center text-xs font-bold w-20 sticky end-0 z-10 whitespace-nowrap"
                        >
                          {room.name}
                        </td>
                      )}
                      {days.map((day) => (
                        <td key={day} className="border-0 p-0">
                          <ReadonlyCell
                            slot={roomSlotMap[`${day}-${period}-${room.id}`]}
                            viewContext="room"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })
              )
            ) : (
              /* Multi-class view: one section per class, grouped */
              displayClassIds.flatMap((classId) =>
                periods.map((period) => {
                  const isFirstPeriod = period === 0;
                  return (
                    <tr key={`${classId}-${period}`} className={cn(isFirstPeriod && "border-t-2 border-border")}>
                      {isFirstPeriod && (
                        <td
                          rowSpan={periodCount}
                          className="border border-border bg-primary/5 p-2 text-center text-xs font-bold w-20 sticky end-0 z-10 whitespace-nowrap"
                        >
                          {classNames[classId]}
                        </td>
                      )}
                      {days.map((day) => {
                        const key = `${day}-${period}-${classId}`;
                        return (
                          <td key={day} className="border-0 p-0">
                            <SlotCell
                              day={day}
                              period={period}
                              classId={classId}
                              slot={slotMap[key]}
                              conflicts={pendingConflicts[key]}
                              onRemove={slotMap[key] ? () => removeSlot(day, period, classId) : undefined}
                              onEdit={slotMap[key] ? () => setEditingSlot(slotMap[key]) : undefined}
                              substitution={overlayMap[key]}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )
            )}
          </tbody>
        </table>
      </div>

      <DragOverlay>
        {activeSlot && (
          <div className="shadow-xl rounded-md w-24">
            <LessonCard slot={activeSlot} compact />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
