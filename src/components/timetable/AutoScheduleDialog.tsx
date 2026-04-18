"use client";

import { useState, useTransition, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wand2, CheckCircle2, AlertTriangle, Loader2, ChevronDown } from "lucide-react";
import { getClassRequirements, saveClassRequirements, autoScheduleClass } from "@/lib/scheduling-actions";
import { useTimetableStore } from "@/stores/timetable-store";
import { DAYS_HE, PERIOD_LABELS } from "@/lib/constants";
import type { TimetableSlot } from "@/stores/timetable-store";

type Subject = { id: string; name: string; color: string | null };
type ClassInfo = { id: string; name: string; studentCount: number };

interface AutoScheduleDialogProps {
  classes: ClassInfo[];
  subjects: Subject[];
  selectedClassId?: string | null;
  periodCount: number;
  dayCount: number;
  periodTimes?: { start: string; end: string }[];
}

type PlacedSlot = {
  day: number; period: number; classId: string; teacherId: string;
  subjectId: string; roomId: string | null; studyGroupId: string | null;
  subjectName: string; subjectColor: string; teacherName: string;
  className: string; roomName?: string;
};

export function AutoScheduleDialog({
  classes,
  subjects,
  selectedClassId,
  periodCount,
  dayCount,
  periodTimes = [],
}: AutoScheduleDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"requirements" | "results">("requirements");
  const [classId, setClassId] = useState(selectedClassId ?? classes[0]?.id ?? "");
  const [requirements, setRequirements] = useState<Record<string, number>>({}); // subjectId -> hours
  const [noConsecutiveIds, setNoConsecutiveIds] = useState<Set<string>>(new Set());
  const [dayLastPeriods, setDayLastPeriods] = useState<number[]>(
    Array.from({ length: dayCount }, () => periodCount - 1)
  );
  const [showDayLimits, setShowDayLimits] = useState(false);
  const [loadingReqs, setLoadingReqs] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isScheduling, startScheduling] = useTransition();
  const [placedSlots, setPlacedSlots] = useState<PlacedSlot[]>([]);
  const [unplaced, setUnplaced] = useState<{ subjectName: string; remaining: number; reason: string }[]>([]);

  const { addSlot, slots } = useTimetableStore();

  // Sync dayLastPeriods length if dayCount changes
  useEffect(() => {
    setDayLastPeriods(Array.from({ length: dayCount }, () => periodCount - 1));
  }, [dayCount, periodCount]);

  // Load existing requirements when class or dialog opens
  useEffect(() => {
    if (!classId || !open) return;
    setLoadingReqs(true);
    getClassRequirements(classId)
      .then((reqs) => {
        const map: Record<string, number> = {};
        for (const r of reqs) map[r.subjectId] = r.hoursPerWeek;
        setRequirements(map);
      })
      .catch(() => {})
      .finally(() => setLoadingReqs(false));
  }, [classId, open]);

  function handleOpen() {
    setStep("requirements");
    setPlacedSlots([]);
    setUnplaced([]);
    setNoConsecutiveIds(new Set());
    if (selectedClassId) setClassId(selectedClassId);
    setOpen(true);
  }

  function toggleNoConsecutive(subjectId: string) {
    setNoConsecutiveIds((prev) => {
      const next = new Set(prev);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return next;
    });
  }

  function handleSaveAndSchedule() {
    const reqs = Object.entries(requirements)
      .map(([subjectId, hoursPerWeek]) => ({ subjectId, hoursPerWeek }))
      .filter((r) => r.hoursPerWeek > 0);

    startSaving(async () => {
      await saveClassRequirements(classId, reqs);
    });

    startScheduling(async () => {
      await saveClassRequirements(classId, reqs);
      const result = await autoScheduleClass(classId, {
        dayLastPeriods,
        noConsecutiveSubjectIds: [...noConsecutiveIds],
      });
      setPlacedSlots(result.placed);
      setUnplaced(result.output.unplaced);
      setStep("results");
    });
  }

  function handleApply() {
    for (const s of placedSlots) {
      addSlot({
        day: s.day,
        period: s.period,
        classId: s.classId,
        teacherId: s.teacherId,
        subjectId: s.subjectId,
        roomId: s.roomId,
        studyGroupId: s.studyGroupId,
        subjectName: s.subjectName,
        subjectColor: s.subjectColor,
        teacherName: s.teacherName,
        className: s.className,
        roomName: s.roomName,
      });
    }
    setOpen(false);
  }

  function periodLabel(i: number) {
    const t = periodTimes[i];
    if (t?.end) return `${PERIOD_LABELS[i]} (עד ${t.end})`;
    return PERIOD_LABELS[i];
  }

  const selectedClass = classes.find((c) => c.id === classId);
  const existingSlotsForClass = slots.filter((s: TimetableSlot) => s.classId === classId).length;
  const totalHours = Object.values(requirements).reduce((a, b) => a + b, 0);
  const days = Array.from({ length: dayCount }, (_, i) => i);

  return (
    <>
      <Button size="sm" variant="outline" className="gap-2" onClick={handleOpen}>
        <Wand2 className="h-4 w-4" />
        שיבוץ אוטומטי
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) setOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              שיבוץ אוטומטי
            </DialogTitle>
          </DialogHeader>

          {/* Class selector */}
          <div className="space-y-1">
            <label className="text-sm font-medium">כיתה</label>
            <select
              value={classId}
              onChange={(e) => { setClassId(e.target.value); setStep("requirements"); }}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {existingSlotsForClass > 0 && (
              <p className="text-xs text-amber-600">
                ⚠️ לכיתה זו כבר מוצבים {existingSlotsForClass} שיעורים. השיבוץ האוטומטי יוסיף שיעורים נוספים.
              </p>
            )}
          </div>

          {step === "requirements" && (
            <>
              {/* Subject hours */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">מקצועות ושעות שבועיות</label>
                  <span className="text-xs text-muted-foreground">סה״כ: {totalHours} שעות</span>
                </div>

                {loadingReqs ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="border rounded-md divide-y max-h-64 overflow-y-auto">
                    {subjects.map((subject) => {
                      const hours = requirements[subject.id] ?? 0;
                      const isNoConsec = noConsecutiveIds.has(subject.id);
                      return (
                        <div key={subject.id} className="flex items-center justify-between px-3 py-2 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {subject.color && (
                              <span
                                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: subject.color }}
                              />
                            )}
                            <span className="text-sm truncate">{subject.name}</span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {/* No-consecutive toggle — only when ≥2 hours */}
                            {hours >= 2 && (
                              <button
                                type="button"
                                onClick={() => toggleNoConsecutive(subject.id)}
                                title={isNoConsec ? "ביטול מניעת שיעורים רצופים" : "מנע שיעורים רצופים"}
                                className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
                                  isNoConsec
                                    ? "bg-amber-100 dark:bg-amber-900/40 border-amber-400 text-amber-700 dark:text-amber-300"
                                    : "border-input text-muted-foreground hover:bg-muted"
                                }`}
                              >
                                ≠≠
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setRequirements((prev) => ({
                                ...prev,
                                [subject.id]: Math.max(0, (prev[subject.id] ?? 0) - 1),
                              }))}
                              className="w-7 h-7 rounded border border-input hover:bg-muted flex items-center justify-center text-sm font-medium"
                            >
                              −
                            </button>
                            <span className="w-7 text-center text-sm font-medium tabular-nums">{hours}</span>
                            <button
                              type="button"
                              onClick={() => setRequirements((prev) => ({
                                ...prev,
                                [subject.id]: (prev[subject.id] ?? 0) + 1,
                              }))}
                              className="w-7 h-7 rounded border border-input hover:bg-muted flex items-center justify-center text-sm font-medium"
                            >
                              +
                            </button>
                            <span className="text-xs text-muted-foreground w-8">שע׳</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {noConsecutiveIds.size > 0 && (
                  <p className="text-xs text-amber-600">
                    ≠≠ = ללא שיעורים רצופים ({[...noConsecutiveIds].map(id => subjects.find(s => s.id === id)?.name).join(", ")})
                  </p>
                )}
              </div>

              {/* Per-day end period */}
              <div className="border rounded-md overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowDayLimits(v => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <span>שעות סיום לפי יום</span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showDayLimits ? "rotate-180" : ""}`} />
                </button>
                {showDayLimits && (
                  <div className="p-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {days.map((day) => (
                      <div key={day} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-14 flex-shrink-0">{DAYS_HE[day]}</span>
                        <select
                          value={dayLastPeriods[day]}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setDayLastPeriods((prev) => {
                              const next = [...prev];
                              next[day] = val;
                              return next;
                            });
                          }}
                          className="flex-1 h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                        >
                          {Array.from({ length: periodCount }, (_, i) => (
                            <option key={i} value={i}>
                              {periodTimes[i]?.end ? `שע׳ ${i + 1} (עד ${periodTimes[i].end})` : `שיעור ${i + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSaveAndSchedule}
                  disabled={totalHours === 0 || isScheduling || isSaving || loadingReqs}
                  className="gap-2"
                >
                  {isScheduling ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />מבצע שיבוץ...</>
                  ) : (
                    <><Wand2 className="h-4 w-4" />שמור ושבץ</>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
              </div>
            </>
          )}

          {step === "results" && (
            <>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-700 bg-green-50 dark:bg-green-950/30 rounded-md px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm font-medium">
                    {placedSlots.length} שיעורים שובצו בהצלחה
                    {selectedClass ? ` לכיתה ${selectedClass.name}` : ""}
                  </span>
                </div>

                {unplaced.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" />
                      לא הצלחנו לשבץ:
                    </p>
                    <div className="border border-destructive/20 rounded-md divide-y text-sm">
                      {unplaced.map((u, i) => (
                        <div key={i} className="px-3 py-1.5 flex justify-between gap-2">
                          <span className="font-medium">{u.subjectName}</span>
                          <span className="text-muted-foreground text-xs">{u.remaining} שע׳ — {u.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {placedSlots.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">תצוגה מקדימה ({placedSlots.length}):</p>
                    <div className="border rounded-md divide-y max-h-52 overflow-y-auto text-sm">
                      {[...placedSlots]
                        .sort((a, b) => a.day !== b.day ? a.day - b.day : a.period - b.period)
                        .map((s, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-1.5">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.subjectColor }} />
                            <span className="font-medium">{s.subjectName}</span>
                            <span className="text-muted-foreground text-xs">
                              {DAYS_HE[s.day]}, שיעור {s.period + 1} — {s.teacherName}
                              {s.roomName ? ` — ${s.roomName}` : ""}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {placedSlots.length > 0 && (
                  <Button onClick={handleApply} className="gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    החל שיבוץ
                  </Button>
                )}
                <Button variant="outline" onClick={() => setStep("requirements")}>חזרה</Button>
                <Button variant="ghost" onClick={() => setOpen(false)}>סגור</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
