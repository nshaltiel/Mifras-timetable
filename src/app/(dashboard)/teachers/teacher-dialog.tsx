"use client";

import { useState, useTransition } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil } from "lucide-react";
import { setTeacherExcludedClasses } from "@/lib/actions";

interface ClassOption { id: string; name: string; grade: number }

interface TeacherDialogProps {
  subjects: { id: string; name: string }[];
  allClasses: ClassOption[];
  action: (data: FormData) => Promise<unknown>;
  title: string;
  defaultValues?: {
    name: string;
    email: string;
    phone: string;
    maxHoursPerWeek: string;
    subjectIds?: string[];
    excludedClassIds?: string[];
  };
  isEdit?: boolean;
  teacherId?: string;
}

export function TeacherDialog({
  subjects,
  allClasses,
  action,
  title,
  defaultValues,
  isEdit,
}: TeacherDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [excludedClassIds, setExcludedClassIds] = useState<string[]>(
    defaultValues?.excludedClassIds ?? []
  );

  function toggleExcluded(classId: string) {
    setExcludedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await action(formData);
        // If editing and teacherId present, sync excluded classes
        const teacherIdField = formData.get("teacherId") as string | null;
        if (teacherIdField) {
          await setTeacherExcludedClasses(teacherIdField, excludedClassIds);
        }
      } finally {
        setOpen(false);
      }
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
              הוספת מורה
            </Button>
          )
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pe-1">
          {/* Basic info */}
          <div className="space-y-1">
            <Label htmlFor="name">שם מלא</Label>
            <Input id="name" name="name" defaultValue={defaultValues?.name} required
              className="border-mifras-ink-200 focus:border-mifras-orange-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="email">אימייל</Label>
              <Input id="email" name="email" type="email" dir="ltr"
                defaultValue={defaultValues?.email}
                className="border-mifras-ink-200 focus:border-mifras-orange-500" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">טלפון</Label>
              <Input id="phone" name="phone" dir="ltr"
                defaultValue={defaultValues?.phone}
                className="border-mifras-ink-200 focus:border-mifras-orange-500" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="maxHoursPerWeek">שעות מקסימום בשבוע</Label>
            <Input id="maxHoursPerWeek" name="maxHoursPerWeek" type="number" min={1} dir="ltr"
              defaultValue={defaultValues?.maxHoursPerWeek}
              className="border-mifras-ink-200 focus:border-mifras-orange-500" />
          </div>

          {/* Subjects */}
          {subjects.length > 0 && (
            <div className="space-y-2">
              <Label>מקצועות</Label>
              <div className="flex flex-wrap gap-1.5">
                {subjects.map((s) => {
                  const checked = defaultValues?.subjectIds?.includes(s.id);
                  return (
                    <label key={s.id} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" name="subjectIds" value={s.id}
                        defaultChecked={checked} className="rounded" />
                      <span className="text-[13px]">{s.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Excluded classes */}
          {allClasses.length > 0 && (
            <div className="space-y-2">
              <Label>כיתות מוחרגות</Label>
              <p className="text-[12px] text-mifras-ink-400">מורה לא ישובץ לכיתות שנבחרו</p>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto rounded-lg border border-mifras-ink-100 p-2.5">
                {allClasses.map((c) => {
                  const isExcluded = excludedClassIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleExcluded(c.id)}
                      className={`px-2 h-7 rounded-md text-[12px] border transition-colors ${
                        isExcluded
                          ? "bg-mifras-danger/10 text-mifras-danger border-mifras-danger/30"
                          : "border-mifras-ink-200 text-mifras-ink-700 hover:border-mifras-navy-300"
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={isPending}>
              {isPending ? "שומר..." : "שמירה"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              ביטול
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
