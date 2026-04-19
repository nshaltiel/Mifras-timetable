"use client";

import { useState, useEffect, useId } from "react";
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
import { isTeacherFree } from "@/engine/availability";
import { CONSTRAINT } from "@/lib/constraint-types";

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
  classes: {
    id: string;
    name: string;
    studentCount: number;
    homeroomTeacherId?: string | null;
    layerAllowedRoomIds?: string[] | null;
    excludedTeacherIds?: string[];
  }[];
  rooms: { id: string; name: string; capacity: number }[];
  subjects: { id: string; name: string; color: string | null; category?: string | null }[];
  studyGroups: StudyGroup[];
  teacherConstraints?: { teacherId: string; type: string; day: number | null; period: number | null }[];
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
  teacherConstraints = [],
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
  const [applyToAllGrade, setApplyToAllGrade] = useState(false);

  // Additional study groups at the same (day, period)
  type ExtraGroup = { key: string; classId: string; studyGroupId: string };
  const extraKeyBase = useId();
  const [extraGroups, setExtraGroups] = useState<ExtraGroup[]>([]);

  // Split period state
  const [isSplit, setIsSplit] = useState(!!editingSlot?.splitGroupId);
  const [splitSubjectId, setSplitSubjectId] = useState("");
  const [splitTeacherId, setSplitTeacherId] = useState("");
  const [splitRoomId, setSplitRoomId] = useState("");

  const isOpen = forceOpen || open;

  const { addSlot, removeSlot, removeSplitHalf, slots } = useTimetableStore();

  // Slots excluding the one(s) currently being edited (for conflict checks)
  // For split edits: exclude all slots with the same splitGroupId
  const otherSlots = slots.filter((s: TimetableSlot) => {
    if (!editingSlot) return true;
    if (editingSlot.splitGroupId && s.splitGroupId === editingSlot.splitGroupId) return false;
    return !(s.day === editingSlot.day && s.period === editingSlot.period && s.classId === editingSlot.classId);
  });

  // If editing a split slot, find the partner to pre-populate split B fields
  useEffect(() => {
    if (editingSlot?.splitGroupId) {
      const partner = slots.find(
        (s: TimetableSlot) => s.splitGroupId === editingSlot.splitGroupId && s.id !== editingSlot.id
      );
      if (partner) {
        setIsSplit(true);
        setSplitSubjectId(partner.subjectId);
        setSplitTeacherId(partner.teacherId);
        setSplitRoomId(partner.roomId ?? "");
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedClass = classes.find((c) => c.id === classId);

  // Rooms already occupied at the selected day+period (exclude same study group — they share a room)
  const occupiedRoomIds = new Set(
    otherSlots
      .filter((s: TimetableSlot) =>
        s.day === day && s.period === period && s.roomId &&
        !(studyGroupId && s.studyGroupId === studyGroupId)
      )
      .map((s: TimetableSlot) => s.roomId as string)
  );

  // Layer-filtered rooms: if the selected class has a layer with allowedRooms, only show those
  const layerAllowedRoomIds = selectedClass?.layerAllowedRoomIds ?? null;
  const allRoomsWithStatus = rooms.map((r) => ({
    room: r,
    occupied: occupiedRoomIds.has(r.id),
    notInLayer: layerAllowedRoomIds != null && !layerAllowedRoomIds.includes(r.id),
  }));
  // Keep backward-compat variable for capacity warning logic
  const availableRooms = rooms;

  // Teacher availability at selected day+period
  const hardConstraints = teacherConstraints.filter((c) => c.type === CONSTRAINT.UNAVAILABLE);
  // Excluded teacher IDs for the selected class
  const excludedTeacherIds = new Set(selectedClass?.excludedTeacherIds ?? []);

  const teacherOptionsForSubject = subjectId
    ? teachers.filter((t) => t.subjects.some((ts) => ts.subject.id === subjectId))
    : teachers;
  const teacherOptionsWithStatus = teacherOptionsForSubject.map((t) => {
    const free = isTeacherFree(t.id, day, period, otherSlots, hardConstraints.map((c) => ({ ...c, day: c.day ?? undefined, period: c.period ?? undefined })));
    const booked = otherSlots.some((s: TimetableSlot) =>
      s.teacherId === t.id && s.day === day && s.period === period &&
      !(studyGroupId && s.studyGroupId === studyGroupId)
    );
    const blocked = hardConstraints.some((c) => c.teacherId === t.id && (c.day == null || c.day === day) && (c.period == null || c.period === period));
    const excluded = excludedTeacherIds.has(t.id);
    const reason = booked ? " — משובץ כבר" : blocked ? " — אילוץ" : excluded ? " — לא מורשה לכיתה" : "";
    return { t, free: free && !excluded, reason };
  });

  // Teacher options for the split-B half: same logic but filtered to splitSubjectId, excluding A teacher
  const splitTeacherOptionsForSubject = splitSubjectId
    ? teachers.filter((t) => t.subjects.some((ts) => ts.subject.id === splitSubjectId) && t.id !== teacherId)
    : teachers.filter((t) => t.id !== teacherId);
  const splitTeacherOptionsWithStatus = splitTeacherOptionsForSubject.map((t) => {
    const booked = otherSlots.some((s: TimetableSlot) =>
      s.teacherId === t.id && s.day === day && s.period === period
    );
    const blocked = hardConstraints.some((c) => c.teacherId === t.id && (c.day == null || c.day === day) && (c.period == null || c.period === period));
    const reason = booked ? " — משובץ כבר" : blocked ? " — אילוץ" : "";
    return { t, free: !booked && !blocked, reason };
  });

  const selectedSubject = subjects.find((s) => s.id === subjectId);

  // Homeroom subject auto-lock: if subject is "homeroom" category + class has a homeroom teacher
  const isHomeroomSubject = selectedSubject?.category === "homeroom";
  const homeroomTeacherId = isHomeroomSubject ? (selectedClass?.homeroomTeacherId ?? null) : null;

  // Auto-set teacherId when homeroom subject + class are both selected
  useEffect(() => {
    if (isHomeroomSubject && homeroomTeacherId && teacherId !== homeroomTeacherId) {
      setTeacherId(homeroomTeacherId);
    }
  }, [isHomeroomSubject, homeroomTeacherId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedTeacher = teachers.find((t) => t.id === teacherId);
  const selectedRoom = availableRooms.find((r: { id: string; name: string; capacity: number }) => r.id === roomId);

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

  // Soft constraint hint for selected teacher
  const softHint = teacherId
    ? teacherConstraints.find(
        (c) =>
          c.teacherId === teacherId &&
          (c.day == null || c.day === day) &&
          (c.period == null || c.period === period) &&
          (c.type === CONSTRAINT.AVOID || c.type === CONSTRAINT.PREFER)
      )
    : null;

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

    // If editing, remove the old slot(s) first
    if (isEditing && editingSlot) {
      if (editingSlot.splitGroupId) {
        // Remove both halves of the split being edited
        const partner = slots.find(
          (s: TimetableSlot) => s.splitGroupId === editingSlot.splitGroupId && s.id !== editingSlot.id
        );
        removeSplitHalf(editingSlot);
        if (partner) removeSplitHalf(partner);
      } else {
        removeSlot(editingSlot.day, editingSlot.period, editingSlot.classId);
      }
    }

    // Generate a shared splitGroupId if this is a split period
    const splitGroupId =
      isSplit && splitSubjectId && splitTeacherId
        ? crypto.randomUUID()
        : null;

    const slotBase = {
      day,
      period,
      teacherId,
      subjectId,
      roomId: roomId || null,
      studyGroupId: studyGroupId || null,
      splitGroupId,
      subjectName: subject.name,
      subjectColor: subject.color || "#4d90fe",
      teacherName: teacher.name,
      roomName: room?.name,
    };

    // Build list of classes to add slots for
    const classTargets: { classId: string; className: string }[] =
      applyToAllGrade && selectedStudyGroup && selectedStudyGroup.classes.length > 1
        ? selectedStudyGroup.classes.map((c) => {
            const fullClass = classes.find((x) => x.id === c.classId);
            return { classId: c.classId, className: fullClass?.name ?? c.classId };
          })
        : [{ classId, className: cls.name }];

    const allConflictMsgs: string[] = [];
    for (const target of classTargets) {
      const conflicts = addSlot({ ...slotBase, classId: target.classId, className: target.className });
      if (conflicts.length > 0) {
        allConflictMsgs.push(...conflicts.map((c) => c.message));
      }
    }

    // Place split-B half if split mode is on
    if (splitGroupId && splitSubjectId && splitTeacherId) {
      const splitSubject = subjects.find((s) => s.id === splitSubjectId);
      const splitTeacher = teachers.find((t) => t.id === splitTeacherId);
      const splitRoom = rooms.find((r) => r.id === splitRoomId);
      if (splitSubject && splitTeacher) {
        const splitConflicts = addSlot({
          day,
          period,
          classId,
          className: cls.name,
          teacherId: splitTeacherId,
          teacherName: splitTeacher.name,
          subjectId: splitSubjectId,
          subjectName: splitSubject.name,
          subjectColor: splitSubject.color || "#4d90fe",
          roomId: splitRoomId || null,
          roomName: splitRoom?.name,
          studyGroupId: null,
          splitGroupId,
        });
        if (splitConflicts.length > 0) {
          allConflictMsgs.push(...splitConflicts.map((c) => c.message));
        }
      }
    }

    // Place extra study groups (same day/period, different class+studyGroup)
    for (const eg of extraGroups) {
      if (!eg.classId || !eg.studyGroupId) continue;
      const egGroup = studyGroups.find((g) => g.id === eg.studyGroupId);
      const egClass = classes.find((c) => c.id === eg.classId);
      if (!egGroup || !egClass) continue;
      const egConflicts = addSlot({
        day,
        period,
        classId: eg.classId,
        className: egClass.name,
        teacherId: egGroup.teacher.id,
        teacherName: egGroup.teacher.name,
        subjectId: egGroup.subjectId,
        subjectName: egGroup.subject.name,
        subjectColor: egGroup.subject.color || "#4d90fe",
        roomId: null,
        studyGroupId: eg.studyGroupId,
      });
      if (egConflicts.length > 0) {
        allConflictMsgs.push(...egConflicts.map((c) => c.message));
      }
    }

    if (allConflictMsgs.length > 0) {
      // If we removed old slot(s) and got conflict, restore them
      if (isEditing && editingSlot) {
        addSlot(editingSlot);
      }
      setConflictMsg([...new Set(allConflictMsgs)].join(" | "));
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
    setExtraGroups([]);
    setIsSplit(false);
    setSplitSubjectId("");
    setSplitTeacherId("");
    setSplitRoomId("");
    setConflictMsg("");
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
                  setApplyToAllGrade(false);
                  setExtraGroups([]);
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
              {selectedStudyGroup && selectedStudyGroup.classes.length > 1 && (
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none pt-1">
                  <input
                    type="checkbox"
                    checked={applyToAllGrade}
                    onChange={(e) => setApplyToAllGrade(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <span>
                    החל על כל כיתות הקבוצה ({selectedStudyGroup.classes.length} כיתות)
                  </span>
                </label>
              )}

              {/* Additional study groups at the same time slot */}
              {selectedStudyGroup && !isEditing && (
                <div className="mt-2 space-y-1.5">
                  {extraGroups.map((eg, idx) => {
                    const availClasses = classes.filter(
                      (c) => c.id !== classId && !extraGroups.some((x, i) => i !== idx && x.classId === c.id)
                    );
                    const egStudyGroups = subjectId
                      ? studyGroups.filter(
                          (g) => g.subjectId === subjectId && g.classes.some((c) => c.classId === eg.classId)
                        )
                      : [];
                    return (
                      <div key={eg.key} className="flex gap-1.5 items-center">
                        <select
                          value={eg.classId}
                          onChange={(e) => setExtraGroups((prev) =>
                            prev.map((x, i) => i === idx ? { ...x, classId: e.target.value, studyGroupId: "" } : x)
                          )}
                          className="flex-1 h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                        >
                          <option value="">כיתה</option>
                          {availClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <select
                          value={eg.studyGroupId}
                          onChange={(e) => {
                            const gId = e.target.value;
                            setExtraGroups((prev) =>
                              prev.map((x, i) => i === idx ? { ...x, studyGroupId: gId } : x)
                            );
                          }}
                          className="flex-1 h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                        >
                          <option value="">קבוצה</option>
                          {egStudyGroups.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}{g.level ? ` (${g.level})` : ""} — {g.teacher.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setExtraGroups((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-muted-foreground hover:text-destructive w-6 h-6 flex items-center justify-center rounded hover:bg-destructive/10 text-sm flex-shrink-0"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setExtraGroups((prev) => [
                      ...prev,
                      { key: `${extraKeyBase}-${prev.length}`, classId: "", studyGroupId: "" },
                    ])}
                    className="text-xs text-primary hover:underline"
                  >
                    + הוסף קבוצת לימוד נוספת על אותה שעה
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Split period toggle — only for regular (non-study-group) lessons */}
          {!studyGroupId && (
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isSplit}
                onChange={(e) => {
                  setIsSplit(e.target.checked);
                  if (!e.target.checked) {
                    setSplitSubjectId("");
                    setSplitTeacherId("");
                    setSplitRoomId("");
                  }
                }}
                className="h-4 w-4 rounded border-input"
              />
              <span>פצל שעה — שני שיעורים במקביל לאותה כיתה</span>
            </label>
          )}

          {/* Split-B form */}
          {isSplit && !studyGroupId && (
            <div className="border rounded-md p-3 space-y-2 bg-muted/20">
              <p className="text-xs font-semibold text-muted-foreground">חצי B</p>

              <div className="space-y-1">
                <Label>מקצוע B</Label>
                <select
                  value={splitSubjectId}
                  onChange={(e) => { setSplitSubjectId(e.target.value); setSplitTeacherId(""); }}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">בחר מקצוע</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label>מורה B</Label>
                <select
                  value={splitTeacherId}
                  onChange={(e) => setSplitTeacherId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">בחר מורה</option>
                  {splitTeacherOptionsWithStatus.map(({ t, free, reason }) => (
                    <option key={t.id} value={t.id} disabled={!free}>
                      {t.name}{reason}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label>חדר B (אופציונלי)</Label>
                <select
                  value={splitRoomId}
                  onChange={(e) => setSplitRoomId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">ללא חדר</option>
                  {allRoomsWithStatus.map(({ room: r, occupied }) => (
                    <option key={r.id} value={r.id} disabled={occupied && r.id !== splitRoomId}>
                      {r.name}{r.capacity > 0 ? ` (קיבולת ${r.capacity})` : ""}{occupied ? " — תפוס" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label>מורה</Label>
            {isHomeroomSubject && homeroomTeacherId ? (
              <div className="flex h-9 items-center px-3 rounded-md border border-input bg-muted/30 text-sm">
                <span className="text-foreground">{teachers.find(t => t.id === homeroomTeacherId)?.name ?? "מחנך/ת"}</span>
                <span className="text-xs text-muted-foreground ms-2">— שעת מחנך, נקבע אוטומטית</span>
              </div>
            ) : isHomeroomSubject && !homeroomTeacherId ? (
              <p className="text-sm text-destructive bg-destructive/10 rounded p-2">
                ⚠️ לא הוגדר מחנך לכיתה. הגדר מחנך בהגדרות הכיתה.
              </p>
            ) : (
              <select
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">בחר מורה</option>
                {teacherOptionsWithStatus.map(({ t, free, reason }) => (
                  <option key={t.id} value={t.id} disabled={!free}>
                    {t.name}{reason}
                  </option>
                ))}
              </select>
            )}
            {selectedTeacher && subjectId && !isHomeroomSubject && !selectedTeacher.subjects.some((ts) => ts.subject.id === subjectId) && (
              <p className="text-xs text-amber-600">המורה לא מלמד/ת מקצוע זה בדרך כלל</p>
            )}
            {softHint && (
              <p className={`text-xs ${softHint.type === CONSTRAINT.AVOID ? "text-amber-600" : "text-green-600"}`}>
                {softHint.type === CONSTRAINT.AVOID
                  ? "⚠️ המורה מעדיפ/ה לא ללמד בשעה זו"
                  : "✓ שעה מועדפת למורה"}
              </p>
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
              {allRoomsWithStatus.map(({ room: r, occupied, notInLayer }) => {
                const tooSmall =
                  selectedClass &&
                  r.capacity > 0 &&
                  r.capacity < selectedClass.studentCount;
                return (
                  <option key={r.id} value={r.id} disabled={occupied || notInLayer}>
                    {r.name}
                    {r.capacity > 0 ? ` (קיבולת ${r.capacity})` : ""}
                    {tooSmall ? " ⚠️" : ""}
                    {occupied ? " — תפוס" : ""}
                    {notInLayer ? " — לא מותר לשכבה" : ""}
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
            <Button onClick={handleAdd} disabled={!classId || !teacherId || !subjectId || (isSplit && (!splitSubjectId || !splitTeacherId))}>
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
