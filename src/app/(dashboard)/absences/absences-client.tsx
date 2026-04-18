"use client";

import { useState, useTransition, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { Chip } from "@/components/ui/mifras-chip";
import { Plus, Download, ChevronLeft, Trash2, Search, UserMinus } from "lucide-react";
import { createAbsence, deleteAbsence } from "@/lib/absence-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PERIOD_LABELS } from "@/lib/constants";

const REASONS = [
  { value: "SICK", label: "מחלה" },
  { value: "PERSONAL", label: "אישי" },
  { value: "PROFESSIONAL_DEVELOPMENT", label: "השתלמות" },
  { value: "MILITARY_RESERVE", label: "מילואים" },
  { value: "MATERNITY", label: 'חל"ד' },
  { value: "SCHOOL_EVENT", label: 'אירוע בי"ס' },
  { value: "OTHER", label: "אחר" },
];

const REASON_LABELS: Record<string, string> = Object.fromEntries(
  REASONS.map((r) => [r.value, r.label])
);

const REASON_TONE: Record<string, "accent" | "gold" | "navy" | "ghost"> = {
  SICK: "accent",
  MILITARY_RESERVE: "gold",
  PROFESSIONAL_DEVELOPMENT: "navy",
  PERSONAL: "navy",
  MATERNITY: "sky" as never,
  SCHOOL_EVENT: "ghost",
  OTHER: "ghost",
};

interface Teacher { id: string; name: string }
interface Absence {
  id: string; teacherId: string; date: string; periods: string;
  reason: string; note: string | null; status: string;
  teacher: Teacher;
  substitutions: { id: string; period: number; solutionType: string }[];
  teachablePeriods: number[];
}
interface Props { absences: Absence[]; teachers: Teacher[] }

function statusTone(s: string): "done" | "partial" | "open" | "info" | "neutral" {
  if (s === "RESOLVED") return "done";
  if (s === "PARTIALLY_RESOLVED") return "partial";
  if (s === "UNRESOLVED") return "open";
  return "neutral";
}
function statusLabel(s: string) {
  if (s === "RESOLVED") return "תוקן";
  if (s === "PARTIALLY_RESOLVED") return "חלקי";
  if (s === "UNRESOLVED") return "פתוח";
  return s;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
}

function exportToExcel(absences: Absence[]) {
  // Build a simple HTML table then copy/trigger download as CSV
  const rows = absences.map((a) => {
    const periods: number[] = JSON.parse(a.periods);
    return [
      a.date,
      a.teacher.name,
      REASON_LABELS[a.reason] ?? a.reason,
      periods.map((p) => `${p + 1}`).join(", "),
      statusLabel(a.status),
    ].join(",");
  });
  const csv =
    "תאריך,מורה,סיבה,שיעורים,סטטוס\n" +
    rows.join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `היעדרויות_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function AbsencesClient({ absences, teachers }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterReason, setFilterReason] = useState("");

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
        toast.error(`שגיאה: ${err instanceof Error ? err.message : "שגיאה"}`);
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
      } catch { toast.error("שגיאה במחיקה"); }
    });
  }

  const filtered = useMemo(() => {
    return absences.filter((a) => {
      if (search && !a.teacher.name.includes(search)) return false;
      if (filterStatus && a.status !== filterStatus) return false;
      if (filterReason && a.reason !== filterReason) return false;
      return true;
    });
  }, [absences, search, filterStatus, filterReason]);

  // Group by date descending
  const byDate: Record<string, Absence[]> = {};
  for (const absence of filtered) {
    if (!byDate[absence.date]) byDate[absence.date] = [];
    byDate[absence.date].push(absence);
  }
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-5">
      <PageHeader
        title="היעדרויות"
        subtitle={`${absences.length} היעדרויות רשומות`}
        actions={
          <>
            <Button variant="outline" className="gap-1.5" onClick={() => exportToExcel(filtered)}>
              <Download className="size-3.5" />
              ייצוא
            </Button>
            <Button className="gap-1.5" onClick={() => setOpen(true)}>
              <Plus className="size-3.5" />
              דווח היעדרות חדשה
            </Button>
          </>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2.5 items-center">
        <div className="relative min-w-[240px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-3.5 text-mifras-ink-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם מורה..."
            className="h-9 w-full rounded-full border border-mifras-ink-200 bg-white ps-9 pe-4 text-[13.5px] placeholder:text-mifras-ink-400 focus:outline-none focus:border-mifras-orange-500 focus:ring-1 focus:ring-mifras-orange-500/30"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-9 rounded-full border border-mifras-ink-200 bg-white px-4 text-[13.5px] text-mifras-ink-700 focus:outline-none focus:border-mifras-orange-500 cursor-pointer"
        >
          <option value="">כל הסטטוסים</option>
          <option value="UNRESOLVED">פתוח</option>
          <option value="PARTIALLY_RESOLVED">חלקי</option>
          <option value="RESOLVED">תוקן</option>
        </select>
        <select
          value={filterReason}
          onChange={(e) => setFilterReason(e.target.value)}
          className="h-9 rounded-full border border-mifras-ink-200 bg-white px-4 text-[13.5px] text-mifras-ink-700 focus:outline-none focus:border-mifras-orange-500 cursor-pointer"
        >
          <option value="">כל הסיבות</option>
          {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {/* Table */}
      {sortedDates.length === 0 ? (
        <Panel>
          <PanelBody className="py-16 text-center">
            <UserMinus className="size-12 mx-auto text-mifras-ink-200 mb-3" />
            <p className="text-mifras-ink-400 text-[13.5px]">
              {absences.length === 0
                ? 'אין היעדרויות רשומות. לחץ על "דווח היעדרות חדשה" להוסיף.'
                : "אין תוצאות לפי הסינון הנוכחי"}
            </p>
          </PanelBody>
        </Panel>
      ) : (
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-mifras-paper border-b border-mifras-ink-100">
                  {["תאריך", "מורה", "סיבה", "שיעורים", "סטטוס", ""].map((h) => (
                    <th key={h} className="text-start px-4 py-3 font-semibold text-mifras-navy-700 text-[12px]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-mifras-ink-100">
                {sortedDates.flatMap((dateStr) =>
                  byDate[dateStr].map((absence) => {
                    const parsedPeriods: number[] = JSON.parse(absence.periods);
                    const displayPeriods = parsedPeriods.filter((p) => absence.teachablePeriods.includes(p));
                    const resolvedPeriods = absence.substitutions.map((s) => s.period);
                    return (
                      <tr key={absence.id} className="hover:bg-mifras-ink-50 transition-colors">
                        <td className="px-4 py-3 text-mifras-ink-700">
                          <div className="font-semibold text-mifras-ink-900 text-[13px]">
                            {new Date(absence.date + "T12:00:00").toLocaleDateString("he-IL", {
                              day: "numeric", month: "numeric", year: "2-digit",
                            })}
                          </div>
                          <div className="text-[11.5px] text-mifras-ink-400">
                            {formatDate(absence.date).split(",")[0]}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="size-7 rounded-full bg-mifras-navy-50 text-mifras-navy-700 flex items-center justify-center text-[11px] font-semibold shrink-0">
                              {absence.teacher.name.slice(0, 1)}
                            </div>
                            <span className="font-medium text-mifras-ink-900">{absence.teacher.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Chip tone={(REASON_TONE[absence.reason] as "accent" | "gold" | "navy" | "ghost") ?? "ghost"}>
                            {REASON_LABELS[absence.reason] ?? absence.reason}
                          </Chip>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {displayPeriods.map((p) => (
                              <span
                                key={p}
                                className={`inline-flex items-center px-1.5 h-[19px] rounded text-[10.5px] font-medium ${
                                  resolvedPeriods.includes(p)
                                    ? "bg-emerald-50 text-mifras-success"
                                    : "bg-red-50 text-mifras-danger"
                                }`}
                              >
                                {p + 1}
                              </span>
                            ))}
                            {displayPeriods.length === 0 && (
                              <span className="text-mifras-ink-400 text-[12px]">אין שיעורים</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill tone={statusTone(absence.status)}>
                            {statusLabel(absence.status)}
                          </StatusPill>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <Link href={`/substitutions/${absence.id}`}>
                              <Button variant="ghost" size="sm" className="gap-1 text-mifras-orange-600 hover:text-mifras-orange-700 h-7 px-2 text-[12px]">
                                טפל
                                <ChevronLeft className="size-3" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-mifras-ink-400 hover:text-mifras-danger"
                              onClick={() => handleDelete(absence.id)}
                              disabled={isPending}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Add absence dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>דיווח היעדרות מורה</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>מורה</Label>
              <select
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-mifras-ink-200 bg-transparent px-3 py-1 text-[13.5px] focus:outline-none focus:border-mifras-orange-500"
              >
                <option value="">בחר מורה</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>תאריך</Label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-mifras-ink-200 bg-transparent px-3 py-1 text-[13.5px] focus:outline-none focus:border-mifras-orange-500"
                />
              </div>
              <div className="space-y-1">
                <Label>סיבה</Label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-mifras-ink-200 bg-transparent px-3 py-1 text-[13.5px] focus:outline-none focus:border-mifras-orange-500"
                >
                  {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
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
                        className={`px-2 py-1 rounded-md text-[12px] border transition-colors ${
                          selectedPeriods.includes(i)
                            ? "bg-mifras-orange-500 text-white border-mifras-orange-500"
                            : "border-mifras-ink-200 hover:border-mifras-navy-300 text-mifras-ink-700"
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
                className="flex h-9 w-full rounded-md border border-mifras-ink-200 bg-transparent px-3 py-1 text-[13.5px] focus:outline-none focus:border-mifras-orange-500"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleCreate} disabled={!teacherId || periods.length === 0 || isPending}>
                שמור
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
