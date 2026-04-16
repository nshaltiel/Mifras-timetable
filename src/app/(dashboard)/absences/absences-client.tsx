"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, UserMinus, ChevronLeft } from "lucide-react";
import { createAbsence, deleteAbsence } from "@/lib/absence-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PERIOD_LABELS } from "@/lib/constants";

const REASONS = [
  { value: "SICK", label: "מחלה" },
  { value: "PERSONAL", label: "אישי" },
  { value: "TRAINING", label: "השתלמות" },
  { value: "RESERVE", label: "מילואים" },
  { value: "UNPAID", label: "חל\"ד" },
  { value: "SCHOOL_EVENT", label: "אירוע בי\"ס" },
  { value: "OTHER", label: "אחר" },
];

const REASON_LABELS: Record<string, string> = Object.fromEntries(
  REASONS.map((r) => [r.value, r.label])
);

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  UNRESOLVED: { label: "לא תוקן", variant: "destructive" },
  PARTIALLY_RESOLVED: { label: "תוקן חלקית", variant: "default" },
  RESOLVED: { label: "תוקן", variant: "secondary" },
  NOT_REQUIRED: { label: "אין שיעורים", variant: "secondary" },
};

interface Teacher {
  id: string;
  name: string;
}

interface Absence {
  id: string;
  teacherId: string;
  date: string;
  periods: string;
  reason: string;
  note: string | null;
  status: string;
  teacher: Teacher;
  substitutions: { id: string; period: number; solutionType: string }[];
  teachablePeriods: number[];
}

interface Props {
  absences: Absence[];
  teachers: Teacher[];
}

export function AbsencesClient({ absences, teachers }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Form state
  const [teacherId, setTeacherId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [fullDay, setFullDay] = useState(true);
  const [selectedPeriods, setSelectedPeriods] = useState<number[]>([]);
  const [reason, setReason] = useState("SICK");
  const [note, setNote] = useState("");

  function togglePeriod(p: number) {
    setSelectedPeriods((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p].sort((a, b) => a - b)
    );
  }

  const periods = fullDay ? Array.from({ length: 9 }, (_, i) => i) : selectedPeriods;

  function handleCreate() {
    if (!teacherId || periods.length === 0) return;
    startTransition(async () => {
      try {
        await createAbsence({ teacherId, date, periods, reason, note: note || undefined });
        toast.success("ההיעדרות נרשמה בהצלחה");
        setOpen(false);
        setTeacherId("");
        setNote("");
        setSelectedPeriods([]);
        setFullDay(true);
        router.refresh();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "שגיאה";
        toast.error(`שגיאה: ${msg}`);
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("האם למחוק היעדרות זו?")) return;
    startTransition(async () => {
      try {
        await deleteAbsence(id);
        toast.success("ההיעדרות נמחקה");
        router.refresh();
      } catch {
        toast.error("שגיאה במחיקה");
      }
    });
  }

  // Group absences by date (descending)
  const byDate: Record<string, Absence[]> = {};
  for (const absence of absences) {
    if (!byDate[absence.date]) byDate[absence.date] = [];
    byDate[absence.date].push(absence);
  }
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button className="gap-2" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          רישום היעדרות
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>רישום היעדרות מורה</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>מורה</Label>
                <select
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">בחר מורה</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>תאריך</Label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label>סיבה</Label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  >
                    {REASONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    id="fullDay"
                    type="checkbox"
                    checked={fullDay}
                    onChange={(e) => setFullDay(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="fullDay">כל היום</Label>
                </div>
                {!fullDay && (
                  <div className="space-y-1">
                    <Label>שיעורים</Label>
                    <div className="flex flex-wrap gap-1">
                      {Array.from({ length: 9 }, (_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => togglePeriod(i)}
                          className={`px-2 py-1 rounded text-xs border transition-colors ${
                            selectedPeriods.includes(i)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-input hover:bg-muted"
                          }`}
                        >
                          {PERIOD_LABELS[i] || `שיעור ${i + 1}`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label>הערה (אופציונלי)</Label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="הוסף הערה..."
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  onClick={handleCreate}
                  disabled={!teacherId || periods.length === 0 || isPending}
                >
                  שמור
                </Button>
                <Button variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {sortedDates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <UserMinus className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>אין היעדרויות רשומות. לחץ על "רישום היעדרות" להוסיף.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateStr) => (
            <div key={dateStr}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2 px-1">
                {formatDate(dateStr)}
              </h3>
              <div className="space-y-2">
                {byDate[dateStr].map((absence) => {
                  const parsedPeriods: number[] = JSON.parse(absence.periods);
                  // Only show periods where the teacher actually has a lesson
                  const displayPeriods = parsedPeriods.filter(p => absence.teachablePeriods.includes(p));
                  const resolvedPeriods = absence.substitutions.map((s) => s.period);
                  const statusConfig = STATUS_CONFIG[absence.status] || STATUS_CONFIG.UNRESOLVED;
                  return (
                    <Card key={absence.id}>
                      <CardContent className="py-3 px-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{absence.teacher.name}</span>
                              <Badge variant={statusConfig.variant} className="text-xs">
                                {statusConfig.label}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {REASON_LABELS[absence.reason] || absence.reason}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {displayPeriods.map((p) => (
                                <span
                                  key={p}
                                  className={`text-xs px-1.5 py-0.5 rounded ${
                                    resolvedPeriods.includes(p)
                                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                      : "bg-destructive/10 text-destructive"
                                  }`}
                                >
                                  {PERIOD_LABELS[p] || `שיעור ${p + 1}`}
                                </span>
                              ))}
                            </div>
                            {absence.note && (
                              <p className="text-xs text-muted-foreground">{absence.note}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Link href={`/substitutions/${absence.id}`}>
                              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                                מילוי מקום
                                <ChevronLeft className="h-3 w-3" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(absence.id)}
                              disabled={isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
