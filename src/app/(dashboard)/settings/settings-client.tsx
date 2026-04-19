"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteButton } from "@/components/ui/delete-button";
import { Plus, Pencil, Settings, Upload, Download, Clock, KeyRound } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  createTeacher, updateTeacher, deleteTeacher,
  createClass, updateClass, deleteClass,
  createRoom, updateRoom, deleteRoom,
  createSubject, updateSubject, deleteSubject,
  updateSchoolPeriodTimes, importTeachersFromExcel,
} from "@/lib/actions";
import { createStudyGroup, deleteStudyGroup } from "@/lib/study-group-actions";
import { updateStudyGroup } from "@/lib/scheduling-actions";
import { addSchoolUser, removeSchoolUser, updateSchoolName, resetUserPasswordByAdmin, changeOwnPassword } from "@/lib/user-actions";
import { ROOM_TYPE_HE, SUBJECT_CATEGORY_HE, GRADE_HE } from "@/lib/constants";
import { TeacherConstraintGrid } from "@/components/settings/TeacherConstraintGrid";
import { type ConstraintType } from "@/lib/constraint-types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Teacher = {
  id: string; name: string; email: string | null; phone: string | null;
  gender: string;
  maxHoursPerWeek: number | null;
  considerationPercent: number;
  personalSituation: string | null;
  subjects: { id: string; subject: { id: string; name: string } }[];
  homeroomClass: { id: string; name: string } | null;
  constraints: { type: string; day: number | null; period: number | null }[];
  _count: { slots: number };
};
type Class = {
  id: string; name: string; grade: number; studentCount: number;
  homeroomTeacher: { id: string; name: string } | null;
};
type Layer = { id: string; name: string; order: number };
type Room = { id: string; name: string; capacity: number; type: string; maxConcurrentClasses: number; layers: { layerId: string }[] };
type Subject = {
  id: string; name: string; category: string | null; color: string | null;
  _count: { teachers: number };
};
type StudyGroup = {
  id: string; name: string; level: string | null;
  subject: { id: string; name: string; color: string | null };
  teacher: { id: string; name: string };
  classes: { class: { id: string; name: string } }[];
};
type School = { id: string; name: string; periodCount: number; dayCount: number; periodTimes: string | null } | null;
type User = { id: string; name: string; email: string; role: string; createdAt: Date };

interface Props {
  teachers: Teacher[];
  classes: Class[];
  rooms: Room[];
  subjects: Subject[];
  studyGroups: StudyGroup[];
  school: School;
  users: User[];
  layers: Layer[];
}

// ─── Helper: Simple CRUD Dialog ───────────────────────────────────────────────

function CrudDialog({
  title, trigger, onSave, children,
}: {
  title: string;
  trigger: React.ReactNode;
  onSave: (fd: FormData) => Promise<unknown>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(fd: FormData) {
    startTransition(async () => {
      try {
        await onSave(fd);
        toast.success("נשמר בהצלחה");
        setOpen(false);
        router.refresh();
      } catch {
        toast.error("שגיאה בשמירה");
      }
    });
  }

  return (
    <>
      <span onClick={() => setOpen(true)} style={{ display: "contents" }}>
        {trigger}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          {children}
          <div className="flex gap-2 sticky bottom-0 bg-background pt-2 pb-1">
            <Button type="submit" disabled={isPending}>{isPending ? "שומר..." : "שמירה"}</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
          </div>
        </form>
      </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Teachers Tab ─────────────────────────────────────────────────────────────

function TeacherRow({ teacher: t, onDelete, subjects, dayCount, periodCount }: { teacher: Teacher; onDelete: (id: string) => Promise<void>; subjects: Subject[]; dayCount: number; periodCount: number }) {
  const assigned = t._count.slots;
  const max = t.maxHoursPerWeek;
  const effectiveMax = max != null ? Math.floor(max * (1 - (t.considerationPercent || 0) / 100)) : null;
  const overloaded = effectiveMax != null && assigned > effectiveMax;
  const nearMax = effectiveMax != null && !overloaded && assigned >= effectiveMax * 0.9;
  return (
    <TableRow>
      <TableCell className="font-medium">
        <div>{t.name}</div>
        {t.personalSituation && (
          <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 truncate max-w-[150px]" title={t.personalSituation}>
            {t.personalSituation}
          </div>
        )}
      </TableCell>
      <TableCell dir="ltr" className="text-start text-sm">{t.email || "—"}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {t.subjects.map((ts) => <Badge key={ts.id} variant="secondary" className="text-xs">{ts.subject.name}</Badge>)}
        </div>
      </TableCell>
      <TableCell className="text-sm">{t.homeroomClass?.name || "—"}</TableCell>
      <TableCell className="text-sm">
        {max != null ? (
          <span>{max}{t.considerationPercent ? <span className="text-xs text-muted-foreground ms-1">({t.considerationPercent}%)</span> : null}</span>
        ) : "—"}
      </TableCell>
      <TableCell className="text-sm font-medium">
        {effectiveMax ?? "—"}
      </TableCell>
      <TableCell className="text-sm">
        <span className={overloaded ? "text-destructive font-medium" : nearMax ? "text-amber-600 font-medium" : ""}>
          {assigned}{overloaded ? " ⚠️" : ""}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <CrudDialog title="עריכת מורה" trigger={
            <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
          } onSave={(fd) => updateTeacher(t.id, fd)}>
            <TeacherFields subjects={subjects} dayCount={dayCount} periodCount={periodCount} defaultValues={{ name: t.name, email: t.email || "", phone: t.phone || "", gender: t.gender || "UNSPECIFIED", maxHoursPerWeek: t.maxHoursPerWeek?.toString() || "", considerationPercent: t.considerationPercent?.toString() || "0", personalSituation: t.personalSituation || "", subjectIds: t.subjects.map(ts => ts.subject.id), constraints: t.constraints }} />
          </CrudDialog>
          <DeleteButton action={() => onDelete(t.id)} entityName={t.name} />
        </div>
      </TableCell>
    </TableRow>
  );
}

function TeachersTab({ teachers, subjects, dayCount, periodCount }: { teachers: Teacher[]; subjects: Subject[]; dayCount: number; periodCount: number }) {
  const router = useRouter();
  const [isImporting, startImportTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleDelete(id: string) {
    await deleteTeacher(id);
    router.refresh();
  }

  function downloadTemplate() {
    const headers = ["שם", "אימייל", "טלפון", "מגדר (MALE/FEMALE/UNSPECIFIED)", "שעות מקס׳", "אחוז התחשבות", "מצב אישי"];
    const example = ["ישראל ישראלי", "israel@school.co.il", "050-0000000", "MALE", "26", "10", "ילדים קטנים"];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "מורים");
    XLSX.writeFile(wb, "teachers_template.xlsx");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      if (!data) return;
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

      const parsed = rows.map((row) => {
        const name = String(row["שם"] || row["name"] || "").trim();
        const email = String(row["אימייל"] || row["email"] || "").trim();
        const phone = String(row["טלפון"] || row["phone"] || "").trim();
        const genderRaw = String(row["מגדר (MALE/FEMALE/UNSPECIFIED)"] || row["gender"] || "").toUpperCase().trim();
        const gender = ["MALE", "FEMALE"].includes(genderRaw) ? genderRaw : "UNSPECIFIED";
        const maxHours = Number(row["שעות מקס׳"] || row["maxHoursPerWeek"] || 0) || undefined;
        const consideration = Number(row["אחוז התחשבות"] || row["considerationPercent"] || 0) || 0;
        const personal = String(row["מצב אישי"] || row["personalSituation"] || "").trim();
        return { name, email: email || undefined, phone: phone || undefined, gender, maxHoursPerWeek: maxHours, considerationPercent: consideration, personalSituation: personal || undefined };
      }).filter(r => r.name.length >= 2);

      startImportTransition(async () => {
        try {
          const result = await importTeachersFromExcel(parsed);
          toast.success(`יובאו ${result.created} מורים בהצלחה`);
          if (result.errors.length > 0) toast.error(`שגיאות: ${result.errors.slice(0, 3).join(", ")}`);
          router.refresh();
        } catch { toast.error("שגיאה בייבוא"); }
      });
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2 flex-wrap">
        <Button size="sm" variant="outline" className="gap-2" onClick={downloadTemplate}>
          <Download className="h-4 w-4" />תבנית אקסל
        </Button>
        <Button size="sm" variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
          <Upload className="h-4 w-4" />{isImporting ? "מייבא..." : "ייבוא מאקסל"}
        </Button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
        <CrudDialog title="הוספת מורה" trigger={
          <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />הוספת מורה</Button>
        } onSave={createTeacher}>
          <TeacherFields subjects={subjects} dayCount={dayCount} periodCount={periodCount} />
        </CrudDialog>
      </div>
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>שם</TableHead>
              <TableHead>אימייל</TableHead>
              <TableHead>מקצועות</TableHead>
              <TableHead>כיתת אם</TableHead>
              <TableHead>שעות מקס׳</TableHead>
              <TableHead>שעות אפקטיביות</TableHead>
              <TableHead>שעות מוצבות</TableHead>
              <TableHead className="w-20">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teachers.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">אין מורים</TableCell></TableRow>
            ) : teachers.map((t) => (
              <TeacherRow key={t.id} teacher={t} onDelete={handleDelete} subjects={subjects} dayCount={dayCount} periodCount={periodCount} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function TeacherFields({ defaultValues, subjects, dayCount, periodCount }: {
  subjects: Subject[];
  dayCount: number;
  periodCount: number;
  defaultValues?: { name: string; email: string; phone: string; gender: string; maxHoursPerWeek: string; considerationPercent: string; personalSituation: string; subjectIds?: string[]; constraints?: { type: string; day: number | null; period: number | null }[] };
}) {
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>(defaultValues?.subjectIds ?? []);

  // Build constraint record from initial values
  const initialConstraints: Record<string, ConstraintType> = {};
  for (const c of defaultValues?.constraints ?? []) {
    if (c.day != null && c.period != null) {
      initialConstraints[`${c.day}-${c.period}`] = c.type as ConstraintType;
    }
  }
  const [constraints, setConstraints] = useState<Record<string, ConstraintType>>(initialConstraints);
  const [showConstraints, setShowConstraints] = useState(Object.keys(initialConstraints).length > 0);

  // Serialize constraints for form submission
  const constraintCells = Object.entries(constraints).map(([key, type]) => {
    const [day, period] = key.split("-").map(Number);
    return { day, period, type };
  });

  function toggleSubject(id: string) {
    setSelectedSubjectIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  return (
    <>
      <div className="space-y-1"><Label>שם מלא</Label><Input name="name" defaultValue={defaultValues?.name} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>אימייל</Label><Input name="email" type="email" dir="ltr" defaultValue={defaultValues?.email} /></div>
        <div className="space-y-1"><Label>טלפון</Label><Input name="phone" dir="ltr" defaultValue={defaultValues?.phone} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>מגדר</Label>
          <select name="gender" defaultValue={defaultValues?.gender || "UNSPECIFIED"} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
            <option value="UNSPECIFIED">לא מצויין</option>
            <option value="MALE">זכר</option>
            <option value="FEMALE">נקבה</option>
          </select>
        </div>
        <div className="space-y-1"><Label>שעות מקסימום</Label><Input name="maxHoursPerWeek" type="number" min={1} dir="ltr" defaultValue={defaultValues?.maxHoursPerWeek} /></div>
      </div>
      <div className="space-y-1">
        <Label>מקצועות ({selectedSubjectIds.length} נבחרו)</Label>
        <div className="border rounded-md p-2 max-h-32 overflow-y-auto">
          <div className="flex flex-wrap gap-1">
            {subjects.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleSubject(s.id)}
                className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                  selectedSubjectIds.includes(s.id)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-input hover:bg-muted"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
        {/* Hidden inputs so FormData includes selected subjects */}
        {selectedSubjectIds.map(id => (
          <input key={id} type="hidden" name="subjectIds" value={id} />
        ))}
      </div>
      <div className="space-y-1">
        <Label>אחוז התחשבות (% הפחתה)</Label>
        <Input name="considerationPercent" type="number" min={0} max={100} dir="ltr" defaultValue={defaultValues?.considerationPercent || "0"} placeholder="0" />
        <p className="text-xs text-muted-foreground">שעות אפקטיביות = שעות מקס׳ × (1 - אחוז/100)</p>
      </div>
      <div className="space-y-1">
        <Label>מצב אישי (אופציונלי)</Label>
        <textarea name="personalSituation" defaultValue={defaultValues?.personalSituation} placeholder="למשל: ילדים קטנים, בן זוג במילואים, גר רחוק..." className="flex min-h-[64px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none" />
      </div>
      {/* Constraints section */}
      <div className="border rounded-md overflow-hidden">
        <button
          type="button"
          onClick={() => setShowConstraints(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <span>
            אילוצים והעדפות
            {constraintCells.length > 0 && (
              <span className="ms-2 text-xs text-primary">({constraintCells.length} תאים מסומנים)</span>
            )}
          </span>
          <span className="text-muted-foreground text-xs">{showConstraints ? "▲" : "▼"}</span>
        </button>
        {showConstraints && (
          <div className="p-3">
            <TeacherConstraintGrid
              dayCount={dayCount}
              periodCount={periodCount}
              value={constraints}
              onChange={setConstraints}
            />
          </div>
        )}
      </div>
      {/* Serialize constraints as hidden JSON input */}
      <input type="hidden" name="constraints" value={JSON.stringify(constraintCells)} />
    </>
  );
}

// ─── Classes Tab ──────────────────────────────────────────────────────────────

function ClassesTab({ classes, teachers }: { classes: Class[]; teachers: Teacher[] }) {
  const router = useRouter();

  async function handleDelete(id: string) {
    await deleteClass(id);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <CrudDialog title="הוספת כיתה" trigger={
          <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />הוספת כיתה</Button>
        } onSave={createClass}>
          <ClassFields teachers={teachers} />
        </CrudDialog>
      </div>
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>שם</TableHead>
              <TableHead>שכבה</TableHead>
              <TableHead>תלמידים</TableHead>
              <TableHead>מחנך/ת</TableHead>
              <TableHead className="w-20">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">אין כיתות</TableCell></TableRow>
            ) : classes.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell><Badge variant="outline">{GRADE_HE[c.grade] || c.grade}</Badge></TableCell>
                <TableCell className="text-sm">{c.studentCount}</TableCell>
                <TableCell className="text-sm">{c.homeroomTeacher?.name || "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <CrudDialog title="עריכת כיתה" trigger={
                      <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
                    } onSave={(fd) => updateClass(c.id, fd)}>
                      <ClassFields teachers={teachers} defaultValues={{ name: c.name, grade: c.grade.toString(), studentCount: c.studentCount.toString(), homeroomTeacherId: c.homeroomTeacher?.id || "" }} />
                    </CrudDialog>
                    <DeleteButton action={() => handleDelete(c.id)} entityName={c.name} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

const GRADE_PRESETS = [
  { value: "", label: "בחר שכבה..." },
  { value: "1", label: "א׳" }, { value: "2", label: "ב׳" }, { value: "3", label: "ג׳" },
  { value: "4", label: "ד׳" }, { value: "5", label: "ה׳" }, { value: "6", label: "ו׳" },
  { value: "7", label: "ז׳" }, { value: "8", label: "ח׳" }, { value: "9", label: "ט׳" },
  { value: "10", label: "י׳" }, { value: "11", label: "י״א" }, { value: "12", label: "י״ב" },
  { value: "other", label: "אחר (הזן ידנית)" },
];

function ClassFields({ teachers, defaultValues }: { teachers: Teacher[]; defaultValues?: { name: string; grade: string; studentCount: string; homeroomTeacherId: string } }) {
  const defaultGrade = defaultValues?.grade ?? "";
  const isCustom = defaultGrade !== "" && !GRADE_PRESETS.some(p => p.value === defaultGrade && p.value !== "" && p.value !== "other");
  const [selectValue, setSelectValue] = useState(isCustom ? "other" : defaultGrade);
  const [customGrade, setCustomGrade] = useState(isCustom ? defaultGrade : "");

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>שם כיתה</Label><Input name="name" defaultValue={defaultValues?.name} required /></div>
        <div className="space-y-1">
          <Label>שכבה</Label>
          <select
            value={selectValue}
            onChange={(e) => { setSelectValue(e.target.value); setCustomGrade(""); }}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            {GRADE_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          {selectValue === "other" && (
            <Input
              placeholder="מספר שכבה (1-12)"
              type="number" min={1} max={12} dir="ltr"
              value={customGrade}
              onChange={(e) => setCustomGrade(e.target.value)}
              autoFocus
            />
          )}
          {/* Hidden input carries the resolved grade value */}
          <input type="hidden" name="grade" value={selectValue === "other" ? customGrade : selectValue} />
        </div>
      </div>
      <div className="space-y-1"><Label>מספר תלמידים</Label><Input name="studentCount" type="number" min={0} dir="ltr" defaultValue={defaultValues?.studentCount || "0"} /></div>
      <div className="space-y-1">
        <Label>מחנך/ת כיתה</Label>
        <select name="homeroomTeacherId" defaultValue={defaultValues?.homeroomTeacherId || ""} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
          <option value="">ללא</option>
          {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
    </>
  );
}

// ─── Rooms Tab ────────────────────────────────────────────────────────────────

function RoomsTab({ rooms, layers }: { rooms: Room[]; layers: Layer[] }) {
  const router = useRouter();

  async function handleDelete(id: string) {
    await deleteRoom(id);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <CrudDialog title="הוספת חדר" trigger={
          <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />הוספת חדר</Button>
        } onSave={createRoom}>
          <RoomFields layers={layers} />
        </CrudDialog>
      </div>
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>שם</TableHead>
              <TableHead>סוג</TableHead>
              <TableHead>קיבולת</TableHead>
              <TableHead>שכבות</TableHead>
              <TableHead className="w-20">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">אין חדרים</TableCell></TableRow>
            ) : rooms.map((r) => {
              const roomLayerNames = r.layers
                .map((lr) => layers.find((l) => l.id === lr.layerId)?.name)
                .filter(Boolean);
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.name}
                    {r.maxConcurrentClasses > 1 && (
                      <span className="ms-1 text-xs text-primary">×{r.maxConcurrentClasses}</span>
                    )}
                  </TableCell>
                  <TableCell><Badge variant="secondary">{ROOM_TYPE_HE[r.type] || r.type}</Badge></TableCell>
                  <TableCell className="text-sm">{r.capacity}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {roomLayerNames.length > 0 ? roomLayerNames.join(", ") : "הכל"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <CrudDialog title="עריכת חדר" trigger={
                        <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
                      } onSave={(fd) => updateRoom(r.id, fd)}>
                        <RoomFields
                          layers={layers}
                          defaultValues={{
                            name: r.name,
                            capacity: r.capacity.toString(),
                            type: r.type,
                            maxConcurrentClasses: r.maxConcurrentClasses.toString(),
                            layerIds: r.layers.map((lr) => lr.layerId),
                          }}
                        />
                      </CrudDialog>
                      <DeleteButton action={() => handleDelete(r.id)} entityName={r.name} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function RoomFields({
  layers,
  defaultValues,
}: {
  layers: Layer[];
  defaultValues?: { name: string; capacity: string; type: string; maxConcurrentClasses?: string; layerIds?: string[] };
}) {
  return (
    <>
      <div className="space-y-1"><Label>שם חדר</Label><Input name="name" defaultValue={defaultValues?.name} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>קיבולת תלמידים</Label><Input name="capacity" type="number" min={0} dir="ltr" defaultValue={defaultValues?.capacity || "35"} /></div>
        <div className="space-y-1">
          <Label>סוג</Label>
          <select name="type" defaultValue={defaultValues?.type || "REGULAR"} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
            {Object.entries(ROOM_TYPE_HE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <Label>מקסימום כיתות בו-זמנית</Label>
        <Input
          name="maxConcurrentClasses"
          type="number"
          min={1}
          max={10}
          dir="ltr"
          defaultValue={defaultValues?.maxConcurrentClasses || "1"}
        />
        <p className="text-xs text-muted-foreground">לרוב הכיתות: 1. לאולם ספורט / ספרייה: 2 ומעלה.</p>
      </div>
      {layers.length > 0 && (
        <div className="space-y-2">
          <Label>זמין לשכבות</Label>
          <p className="text-xs text-muted-foreground">ללא סימון — זמין לכל השכבות</p>
          <div className="flex flex-wrap gap-3">
            {layers.map((layer) => (
              <label key={layer.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="layerIds"
                  value={layer.id}
                  defaultChecked={defaultValues?.layerIds?.includes(layer.id)}
                  className="rounded"
                />
                <span className="text-sm">{layer.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Subjects Tab ─────────────────────────────────────────────────────────────

function SubjectsTab({ subjects }: { subjects: Subject[] }) {
  const router = useRouter();

  async function handleDelete(id: string) {
    await deleteSubject(id);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <CrudDialog title="הוספת מקצוע" trigger={
          <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />הוספת מקצוע</Button>
        } onSave={createSubject}>
          <SubjectFields />
        </CrudDialog>
      </div>
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">צבע</TableHead>
              <TableHead>שם</TableHead>
              <TableHead>קטגוריה</TableHead>
              <TableHead>מורים</TableHead>
              <TableHead className="w-20">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subjects.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">אין מקצועות</TableCell></TableRow>
            ) : subjects.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="h-4 w-4 rounded-full mx-auto" style={{ backgroundColor: s.color || "#4d90fe" }} />
                </TableCell>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>
                  {s.category ? <Badge variant="secondary">{SUBJECT_CATEGORY_HE[s.category] || s.category}</Badge> : "—"}
                </TableCell>
                <TableCell className="text-sm">{s._count.teachers}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <CrudDialog title="עריכת מקצוע" trigger={
                      <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
                    } onSave={(fd) => updateSubject(s.id, fd)}>
                      <SubjectFields defaultValues={{ name: s.name, category: s.category || "", color: s.color || "#4d90fe" }} />
                    </CrudDialog>
                    <DeleteButton action={() => handleDelete(s.id)} entityName={s.name} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SubjectFields({ defaultValues }: { defaultValues?: { name: string; category: string; color: string } }) {
  return (
    <>
      <div className="space-y-1"><Label>שם מקצוע</Label><Input name="name" defaultValue={defaultValues?.name} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>קטגוריה</Label>
          <select name="category" defaultValue={defaultValues?.category || ""} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
            <option value="">ללא</option>
            {Object.entries(SUBJECT_CATEGORY_HE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="space-y-1"><Label>צבע</Label><Input name="color" type="color" defaultValue={defaultValues?.color || "#4d90fe"} className="h-9 p-1" /></div>
      </div>
    </>
  );
}

// ─── Study Groups Tab ─────────────────────────────────────────────────────────

function StudyGroupDialog({
  mode,
  group,
  teachers,
  classes,
  subjects,
  onDone,
}: {
  mode: "create" | "edit";
  group?: StudyGroup;
  teachers: Teacher[];
  classes: Class[];
  subjects: Subject[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(group?.name ?? "");
  const [subjectId, setSubjectId] = useState(group?.subject.id ?? "");
  const [level, setLevel] = useState(group?.level ?? "רגיל");
  const [teacherId, setTeacherId] = useState(group?.teacher.id ?? "");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(
    group?.classes.map(({ class: c }) => c.id) ?? []
  );

  function toggleClass(id: string) {
    setSelectedClassIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function handleSave() {
    if (!name || !subjectId || !teacherId || selectedClassIds.length === 0) return;
    startTransition(async () => {
      try {
        if (mode === "edit" && group) {
          await updateStudyGroup(group.id, { name, subjectId, level, teacherId, classIds: selectedClassIds });
          toast.success("קבוצת הלימוד עודכנה");
        } else {
          await createStudyGroup({ name, subjectId, level, teacherId, classIds: selectedClassIds });
          toast.success("קבוצת הלימוד נוצרה");
        }
        setOpen(false);
        onDone();
      } catch { toast.error("שגיאה"); }
    });
  }

  const filteredTeachers = subjectId
    ? teachers.filter(t => t.subjects.some(ts => ts.subject.id === subjectId))
    : teachers;

  const trigger = mode === "edit"
    ? <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
    : <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />הוספת קבוצה</Button>;

  return (
    <>
      <span onClick={() => {
        // reset for create mode
        if (mode === "create") { setName(""); setSubjectId(""); setLevel("רגיל"); setTeacherId(""); setSelectedClassIds([]); }
        setOpen(true);
      }} style={{ display: "contents" }}>{trigger}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{mode === "edit" ? "עריכת קבוצת לימוד" : "יצירת קבוצת לימוד"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>שם</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>מקצוע</Label>
                <select value={subjectId} onChange={e => { setSubjectId(e.target.value); setTeacherId(""); }}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                  <option value="">בחר</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>רמה</Label>
                <select value={level} onChange={e => setLevel(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                  {["רגיל","מגברת","מחוזקת","בסיסי"].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>מורה</Label>
              <select value={teacherId} onChange={e => setTeacherId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                <option value="">בחר</option>
                {filteredTeachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>כיתות ({selectedClassIds.length} נבחרו)</Label>
              <div className="border rounded-md p-2 max-h-32 overflow-y-auto">
                <div className="flex flex-wrap gap-1">
                  {classes.map(c => (
                    <button key={c.id} type="button" onClick={() => toggleClass(c.id)}
                      className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                        selectedClassIds.includes(c.id)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-input hover:bg-muted"
                      }`}>
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave}
                disabled={!name || !subjectId || !teacherId || selectedClassIds.length === 0 || isPending}>
                {isPending ? "שומר..." : mode === "edit" ? "שמור" : "צור"}
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StudyGroupsTab({ studyGroups, teachers, classes, subjects }: {
  studyGroups: StudyGroup[]; teachers: Teacher[]; classes: Class[]; subjects: Subject[];
}) {
  const router = useRouter();

  async function handleDelete(id: string) {
    await deleteStudyGroup(id);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <StudyGroupDialog mode="create" teachers={teachers} classes={classes} subjects={subjects} onDone={() => router.refresh()} />
      </div>
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>שם</TableHead>
              <TableHead>מקצוע</TableHead>
              <TableHead>רמה</TableHead>
              <TableHead>מורה</TableHead>
              <TableHead>כיתות</TableHead>
              <TableHead className="w-24">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {studyGroups.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">אין קבוצות לימוד</TableCell></TableRow>
            ) : studyGroups.map(g => (
              <TableRow key={g.id}>
                <TableCell className="font-medium">{g.name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {g.subject.color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: g.subject.color }} />}
                    <span className="text-sm">{g.subject.name}</span>
                  </div>
                </TableCell>
                <TableCell>{g.level && <Badge variant="secondary" className="text-xs">{g.level}</Badge>}</TableCell>
                <TableCell className="text-sm">{g.teacher.name}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-0.5">
                    {g.classes.map(({ class: c }) => <Badge key={c.id} variant="outline" className="text-xs">{c.name}</Badge>)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <StudyGroupDialog
                      mode="edit"
                      group={g}
                      teachers={teachers}
                      classes={classes}
                      subjects={subjects}
                      onDone={() => router.refresh()}
                    />
                    <DeleteButton action={() => handleDelete(g.id)} entityName={g.name} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Period Times Tab ─────────────────────────────────────────────────────────

function PeriodTimesTab({ school }: { school: School }) {
  const router = useRouter();
  const [isSaving, startSavingTransition] = useTransition();
  const periodCount = school?.periodCount ?? 10;

  const initialTimes = (): { start: string; end: string }[] => {
    if (school?.periodTimes) {
      try { return JSON.parse(school.periodTimes); } catch { /* ignore */ }
    }
    return Array.from({ length: periodCount }, () => ({ start: "", end: "" }));
  };

  const [times, setTimes] = useState<{ start: string; end: string }[]>(initialTimes);

  function update(index: number, field: "start" | "end", value: string) {
    setTimes(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
  }

  function handleSave() {
    startSavingTransition(async () => {
      try {
        await updateSchoolPeriodTimes(times);
        toast.success("שעות השיעורים נשמרו");
        router.refresh();
      } catch { toast.error("שגיאה בשמירה"); }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Clock className="h-4 w-4" />
        <p className="text-sm">הגדר שעות התחלה וסיום לכל שיעור. שיעורים אלה יוצגו במערכת השעות ובהודעות מילוי מקום.</p>
      </div>
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">שיעור</TableHead>
              <TableHead>שעת התחלה</TableHead>
              <TableHead>שעת סיום</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: periodCount }, (_, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">שיעור {i + 1}</TableCell>
                <TableCell>
                  <Input
                    type="time"
                    dir="ltr"
                    value={times[i]?.start || ""}
                    onChange={(e) => update(i, "start", e.target.value)}
                    className="w-32"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="time"
                    dir="ltr"
                    value={times[i]?.end || ""}
                    onChange={(e) => update(i, "end", e.target.value)}
                    className="w-32"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Button onClick={handleSave} disabled={isSaving} className="gap-2">
        {isSaving ? "שומר..." : "שמור שעות"}
      </Button>
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab({ users }: { users: User[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "" });
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [changeOwnOpen, setChangeOwnOpen] = useState(false);
  const [ownPasswords, setOwnPasswords] = useState({ current: "", next: "" });

  function handleAdd() {
    startTransition(async () => {
      try {
        await addSchoolUser(newUser);
        toast.success("המשתמש נוסף בהצלחה");
        setAddOpen(false);
        setNewUser({ name: "", email: "", password: "" });
        router.refresh();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "שגיאה");
      }
    });
  }

  function handleRemove(userId: string) {
    startTransition(async () => {
      try {
        await removeSchoolUser(userId);
        router.refresh();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "שגיאה");
      }
    });
  }

  function handleResetPassword() {
    startTransition(async () => {
      try {
        await resetUserPasswordByAdmin(resetUserId, resetPassword);
        toast.success("הסיסמה אופסה בהצלחה");
        setResetOpen(false);
        setResetPassword("");
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "שגיאה");
      }
    });
  }

  function handleChangeOwnPassword() {
    startTransition(async () => {
      try {
        await changeOwnPassword(ownPasswords.current, ownPasswords.next);
        toast.success("הסיסמה עודכנה בהצלחה");
        setChangeOwnOpen(false);
        setOwnPasswords({ current: "", next: "" });
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "שגיאה");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Button size="sm" variant="outline" className="gap-2" onClick={() => setChangeOwnOpen(true)}>
          <KeyRound className="h-3.5 w-3.5" />שינוי הסיסמה שלי
        </Button>
        <Button size="sm" className="gap-2" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />הוספת משתמש
        </Button>
      </div>

      {/* Add user dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>הוספת משתמש</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>שם</Label>
              <Input value={newUser.name} onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>אימייל</Label>
              <Input type="email" dir="ltr" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>סיסמה ראשונית</Label>
              <Input type="password" dir="ltr" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAdd} disabled={!newUser.name || !newUser.email || !newUser.password || isPending}>הוסף</Button>
              <Button variant="outline" onClick={() => setAddOpen(false)}>ביטול</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset user password dialog (admin) */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>איפוס סיסמה</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">הגדר סיסמה חדשה עבור המשתמש.</p>
            <div className="space-y-1">
              <Label>סיסמה חדשה</Label>
              <Input type="password" dir="ltr" value={resetPassword} onChange={e => setResetPassword(e.target.value)} placeholder="לפחות 6 תווים" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleResetPassword} disabled={!resetPassword || isPending}>אפס סיסמה</Button>
              <Button variant="outline" onClick={() => setResetOpen(false)}>ביטול</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change own password dialog */}
      <Dialog open={changeOwnOpen} onOpenChange={setChangeOwnOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>שינוי הסיסמה שלי</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>סיסמה נוכחית</Label>
              <Input type="password" dir="ltr" value={ownPasswords.current} onChange={e => setOwnPasswords(p => ({ ...p, current: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>סיסמה חדשה</Label>
              <Input type="password" dir="ltr" value={ownPasswords.next} onChange={e => setOwnPasswords(p => ({ ...p, next: e.target.value }))} placeholder="לפחות 6 תווים" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleChangeOwnPassword} disabled={!ownPasswords.current || !ownPasswords.next || isPending}>עדכן סיסמה</Button>
              <Button variant="outline" onClick={() => setChangeOwnOpen(false)}>ביטול</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>שם</TableHead>
              <TableHead>אימייל</TableHead>
              <TableHead>תפקיד</TableHead>
              <TableHead className="w-24">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">אין משתמשים</TableCell></TableRow>
            ) : users.map(u => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell dir="ltr" className="text-start text-sm">{u.email}</TableCell>
                <TableCell><Badge variant="secondary" className="text-xs">{u.role}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="איפוס סיסמה"
                      onClick={() => { setResetUserId(u.id); setResetPassword(""); setResetOpen(true); }}>
                      <KeyRound className="h-3.5 w-3.5" />
                    </Button>
                    {users.length > 1 && (
                      <DeleteButton action={async () => { await removeSchoolUser(u.id); router.refresh(); }} entityName={u.name} />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Main Settings Client ─────────────────────────────────────────────────────

const TABS = [
  { id: "teachers", label: "מורים" },
  { id: "classes", label: "כיתות" },
  { id: "rooms", label: "חדרים" },
  { id: "subjects", label: "מקצועות" },
  { id: "study-groups", label: "קבוצות לימוד" },
  { id: "period-times", label: "שעות שיעורים" },
  { id: "users", label: "משתמשים" },
] as const;

type TabId = typeof TABS[number]["id"];

export function SettingsClient({ teachers, classes, rooms, subjects, studyGroups, school, users, layers }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("teachers");
  const router = useRouter();
  const [isPendingName, startNameTransition] = useTransition();
  const [editingName, setEditingName] = useState(false);
  const [schoolNameInput, setSchoolNameInput] = useState(school?.name ?? "");

  function handleSaveName() {
    startNameTransition(async () => {
      try {
        await updateSchoolName(schoolNameInput);
        toast.success("שם בית הספר עודכן");
        setEditingName(false);
        router.refresh();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "שגיאה");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Settings className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-2xl font-bold">הגדרות</h2>
        {school && !editingName && (
          <>
            <span className="text-muted-foreground text-sm">— {school.name}</span>
            <button onClick={() => { setSchoolNameInput(school.name); setEditingName(true); }}
              className="text-xs text-primary hover:underline flex items-center gap-1">
              <Pencil className="h-3 w-3" />שנה שם
            </button>
          </>
        )}
        {editingName && (
          <div className="flex items-center gap-2 ms-2">
            <Input value={schoolNameInput} onChange={e => setSchoolNameInput(e.target.value)}
              className="h-8 text-sm w-52" onKeyDown={e => e.key === "Enter" && handleSaveName()} />
            <Button size="sm" className="h-8" onClick={handleSaveName} disabled={isPendingName}>שמור</Button>
            <Button size="sm" variant="outline" className="h-8" onClick={() => setEditingName(false)}>ביטול</Button>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "teachers" && <TeachersTab teachers={teachers} subjects={subjects} dayCount={school?.dayCount ?? 6} periodCount={school?.periodCount ?? 9} />}
        {activeTab === "classes" && <ClassesTab classes={classes} teachers={teachers} />}
        {activeTab === "rooms" && <RoomsTab rooms={rooms} layers={layers} />}
        {activeTab === "subjects" && <SubjectsTab subjects={subjects} />}
        {activeTab === "study-groups" && <StudyGroupsTab studyGroups={studyGroups} teachers={teachers} classes={classes} subjects={subjects} />}
        {activeTab === "period-times" && <PeriodTimesTab school={school} />}
        {activeTab === "users" && <UsersTab users={users} />}
      </div>
    </div>
  );
}
