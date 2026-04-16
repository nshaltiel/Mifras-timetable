"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { useTimetableStore } from "@/stores/timetable-store";
import { DAYS_HE, PERIOD_LABELS } from "@/lib/constants";
import type { TimetableSlot } from "@/stores/timetable-store";

type StudyGroup = {
  id: string;
  name: string;
  subjectId: string;
  level: string | null;
  teacher: { id: string; name: string };
  subject: { id: string; name: string; color: string | null };
  classes: { classId: string }[];
};

interface AddLessonDialogProps {
  teachers: { id: string; name: string; maxHoursPerWeek: number | null; subjects: { subject: { id: string; name: string; color: string | null } }[] }[];
  classes: { id: string; name: string; studentCount: number }[];
  rooms: { id: string; name: string; capacity: number }[];
  subjects: { id: string; name: string; color: string | null }[];
  studyGroups: StudyGroup[];
  periodCount: number;
  dayCount?: number;
  periodTimes?: { start: string; end: string }[];
  defaultClassId?: string;
  defaultDay?: number;
  defaultPeriod?: number;
  editingSlot?: TimetableSlot;
  forceOpen?: boolean;
  onClose?: () => void;
}

export function AddLessonDialog({
  teachers,
  classes,
  rooms,
  subjects,
  studyGroups,
  periodCount,
  dayCount = 6,
  periodTimes = [],
  defaultClassId,
  defaultDay,
  defaultPeriod,
  editingSlot,
  forceOpen,
  onClose,
}: AddLessonDialogProps) {
  const isEditing = !!editingSlot;
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState(editingSlot?.classId ?? defaultClassId ?? "");
  const [teacherId, setTeacherId] = useState(editingSlot?.teacherId ?? "");
  const [subjectId, setSubjectId] = useState(editingSlot?.subjectId ?? "");
  const [studyGroupId, setStudyGroupId] = useState(editingSlot?.studyGroupId ?? "");
  const [roomId, setRoomId] = useState(editingSlot?.roomId ?? "");
  const [day, setDay] = useState(editingSlot?.day ?? defaultDay ?? 0);
  const [period, setPeriod] = useState(editingSlot?.period ?? defaultPeriod ?? 0);
  const [conflictMsg, setConflictMsg] = useState("");

  const isOpen = forceOpen || open;

  const { addSlot, removeSlot, slots } = useTimetableStore();

  // Rooms already occupied at the selected day+period
  const occupiedRoomIds = new Set(
    slots
      .filter((s: TimetableSlot) => s.day === day && s.period === period && s.roomId)
      .map((s: TimetableSlot) => s.roomId as string)
  );
  const availableRooms = rooms.filter((r) => !occupiedRoomIds.has(r.id));

  const selectedClass = classes.find((c) => c.id === classId);
  const selectedTeacher = teachers.find((t) => t.id === teacherId);
  const selectedSubject = subjects.find((s) => s.id === subjectId);
  const selectedRoom = availableRooms.find((r) => r.id === roomId);

  // Study groups for the selected subject (filtered by class if selected)
  const relevantStudyGroups = subjectId
    ? studyGroups.filter(
        (g) =>
          g.subjectId === subjectId &&
          (!classId || g.classes.some((c) => c.classId === classId))
      )
    : [];
  const selectedStudyGroup = relevantStudyGroups.find((g) => g.id === studyGroupId);
  const capacityWarning =
    selectedClass &&
    selectedRoom &&
    selectedRoom.capacity > 0 &&
    selectedRoom.capacity < selectedClass.studentCount;

  // Teacher hours warning: count current slots in store
  const teacherCurrentSlots = teacherId
    ? slots.filter((s: TimetableSlot) => s.teacherId === teacherId).length
    : 0;
  const teacherMax = selectedTeacher?.maxHoursPerWeek ?? null;
  const teacherOverloaded = teacherMax != null && teacherCurrentSlots >= teacherMax;
  const teacherNearMax = teacherMax != null && !teacherOverloaded && teacherCurrentSlots >= teacherMax - 2;

  function handleAdd() {
    if (!classId || !teacherId || !subjectId) return;
    const teacher = teachers.find((t) => t.id === teacherId);
    const cls = classes.find((c) => c.id === classId);
    const subject = subjects.find((s) => s.id === subjectId);
    const room = rooms.find((r) => r.id === roomId);
    if (!teacher || !cls || !subject) return;

    // If editing, remove the old slot first
    if (isEditing && editingSlot) {
      removeSlot(editingSlot.day, editingSlot.period, editingSlot.classId);
    }

    const conflicts = addSlot({
      day,
      period,
      classId,
      teacherId,
      subjectId,
      roomId: roomId || null,
      studyGroupId: studyGroupId || null,
      subjectName: subject.name,
      subjectColor: subject.color || "#4d90fe",
      teacherName: teacher.name,
      className: cls.name,
      roomName: room?.name,
    });

    if (conflicts.length > 0) {
      // If we removed old slot and got conflict, restore it
      if (isEditing && editingSlot) {
        addSlot(editingSlot);
      }
      setConflictMsg(conflicts.map((c) => c.message).join(", "));
    } else {
      setConflictMsg("");
      if (forceOpen && onClose) {
        onClose();
      } else {
        setOpen(false);
      }
    }
  }

  function handleClose() {
    if (forceOpen && onClose) {
      onClose();
    } else {
      setOpen(false);
    }
  }

  return (
    <>
      {!forceOpen && (
        <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          <span>הוספת שיעור</span>
        </Button>
      )}
      <Dialog open={isOpen} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "עריכת שיעור" : "הוספת שיעור"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>יום</Label>
              <select
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                {Array.from({ length: dayCount }, (_, i) => (
                  <option key={i} value={i}>{DAYS_HE[i]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>שעה</Label>
              <select
                value={period}
                onChange={(e) => setPeriod(Number(e.target.value))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                {Array.from({ length: periodCount }, (_, i) => {
                  const t = periodTimes[i];
                  const label = t?.start && t?.end ? `${t.start}–${t.end}` : t?.start ? t.start : PERIOD_LABELS[i];
                  return <option key={i} value={i}>{label}</option>;
                })}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>כיתה</Label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="">בחר כיתה</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label>מקצוע</Label>
            <select
              value={subjectId}
              onChange={(e) => { setSubjectId(e.target.value); setStudyGroupId(""); setTeacherId(""); }}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="">בחר מקצוע</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {relevantStudyGroups.length > 0 && (
            <div className="space-y-1">
              <Label>קבוצת לימוד</Label>
              <select
                value={studyGroupId}
                onChange={(e) => {
                  const gId = e.target.value;
                  setStudyGroupId(gId);
                  if (gId) {
                    const g = relevantStudyGroups.find((x) => x.id === gId);
                    if (g) setTeacherId(g.teacher.id);
                  }
                }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">ללא קבוצת לימוד</option>
                {relevantStudyGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}{g.level ? ` (${g.level})` : ""} — {g.teacher.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1">
            <Label>מורה</Label>
            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="">בחר מורה</option>
              {(subjectId
                ? teachers.filter((t) =>
                    t.subjects.some((ts) => ts.subject.id === subjectId)
                  )
                : teachers
              ).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {selectedTeacher && subjectId && !selectedTeacher.subjects.some((ts) => ts.subject.id === subjectId) && (
              <p className="text-xs text-amber-600">המורה לא מלמד/ת מקצוע זה בדרך כלל</p>
            )}
            {selectedTeacher && teacherMax != null && (
              <p className={`text-xs ${teacherOverloaded ? "text-destructive" : teacherNearMax ? "text-amber-600" : "text-muted-foreground"}`}>
                {teacherOverloaded
                  ? `⚠️ עומס מקסימלי! ${teacherCurrentSlots}/${teacherMax} שעות מוצבות`
                  : teacherNearMax
                  ? `⚠️ קרוב לעומס מקסימלי: ${teacherCurrentSlots}/${teacherMax} שעות`
                  : `${teacherCurrentSlots}/${teacherMax} שעות מוצבות`}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label>
              חדר (אופציונלי){" "}
              {occupiedRoomIds.size > 0 && (
                <span className="text-xs text-muted-foreground font-normal">
                  — {occupiedRoomIds.size} תפוסים
                </span>
              )}
            </Label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="">ללא חדר</option>
              {availableRooms.map((r) => {
                const tooSmall =
                  selectedClass &&
                  r.capacity > 0 &&
                  r.capacity < selectedClass.studentCount;
                return (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.capacity > 0 ? ` (קיבולת ${r.capacity})` : ""}
                    {tooSmall ? " ⚠️" : ""}
                  </option>
                );
              })}
            </select>
            {capacityWarning && (
              <p className="text-xs text-amber-600">
                ⚠️ קיבולת החדר ({selectedRoom!.capacity}) קטנה ממספר תלמידי הכיתה ({selectedClass!.studentCount})
              </p>
            )}
          </div>

          {conflictMsg && (
            <p className="text-destructive text-sm bg-destructive/10 rounded p-2">
              ⚠️ {conflictMsg}
            </p>
          )}

          <div className="flex gap-2">
            <Button onClick={handleAdd} disabled={!classId || !teacherId || !subjectId}>
              {isEditing ? "שמור" : "הוספה"}
            </Button>
            <Button variant="outline" onClick={handleClose}>ביטול</Button>
          </div>
        </div>
      </DialogContent>
      </Dialog>
    </>
  );
}
