"use client";

import { useState, useTransition } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil } from "lucide-react";

const GRADE_PRESETS = [
  { value: "", label: "בחר שכבה..." },
  { value: "1", label: "א׳" }, { value: "2", label: "ב׳" },
  { value: "3", label: "ג׳" }, { value: "4", label: "ד׳" },
  { value: "5", label: "ה׳" }, { value: "6", label: "ו׳" },
  { value: "7", label: "ז׳" }, { value: "8", label: "ח׳" },
  { value: "9", label: "ט׳" }, { value: "10", label: "י׳" },
  { value: "11", label: "י״א" }, { value: "12", label: "י״ב" },
  { value: "other", label: "אחר (הזן ידנית)" },
];

interface ClassDialogProps {
  teachers: { id: string; name: string }[];
  layers: { id: string; name: string }[];
  action: (data: FormData) => Promise<void>;
  title: string;
  defaultValues?: {
    name: string;
    grade: string;
    studentCount: string;
    homeroomTeacherId: string;
    layerId?: string;
  };
  isEdit?: boolean;
}

export function ClassDialog({ teachers, layers, action, title, defaultValues, isEdit }: ClassDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const defaultGrade = defaultValues?.grade ?? "";
  const isCustomGrade = defaultGrade !== "" && !GRADE_PRESETS.some((p) => p.value === defaultGrade && p.value !== "" && p.value !== "other");
  const [selectValue, setSelectValue] = useState(isCustomGrade ? "other" : defaultGrade);
  const [customGrade, setCustomGrade] = useState(isCustomGrade ? defaultGrade : "");

  const inputCls = "flex h-9 w-full rounded-md border border-mifras-ink-200 bg-transparent px-3 py-1 text-[13.5px] focus:outline-none focus:border-mifras-orange-500";

  function handleSubmit(formData: FormData) {
    const grade = selectValue === "other" ? customGrade : selectValue;
    formData.set("grade", grade);
    startTransition(async () => {
      await action(formData);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          isEdit ? (
            <Button variant="ghost" size="icon" className="size-7">
              <Pencil className="size-3.5" />
            </Button>
          ) : (
            <Button className="gap-1.5">
              <Plus className="size-3.5" />
              הוספת כיתה
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">שם כיתה</Label>
              <Input id="name" name="name" defaultValue={defaultValues?.name} required
                className="border-mifras-ink-200 focus:border-mifras-orange-500" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grade">שכבה</Label>
              <select id="grade" value={selectValue}
                onChange={(e) => { setSelectValue(e.target.value); setCustomGrade(""); }}
                className={inputCls}>
                {GRADE_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              {selectValue === "other" && (
                <Input placeholder="מספר שכבה (1-12)" type="number" min={1} max={12} dir="ltr"
                  value={customGrade} onChange={(e) => setCustomGrade(e.target.value)} required autoFocus
                  className="mt-1.5 border-mifras-ink-200 focus:border-mifras-orange-500" />
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="studentCount">מספר תלמידים</Label>
              <Input id="studentCount" name="studentCount" type="number" min={0} dir="ltr"
                defaultValue={defaultValues?.studentCount || "0"}
                className="border-mifras-ink-200 focus:border-mifras-orange-500" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="homeroomTeacherId">מחנך/ת</Label>
              <select id="homeroomTeacherId" name="homeroomTeacherId"
                defaultValue={defaultValues?.homeroomTeacherId || ""}
                className={inputCls}>
                <option value="">ללא</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          {/* Layer */}
          {layers.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="layerId">שכבת ניהול</Label>
              <select id="layerId" name="layerId"
                defaultValue={defaultValues?.layerId || ""}
                className={inputCls}>
                <option value="">ללא שכבה</option>
                {layers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="submit"
              disabled={isPending || !selectValue || (selectValue === "other" && !customGrade)}>
              {isPending ? "שומר..." : "שמירה"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
