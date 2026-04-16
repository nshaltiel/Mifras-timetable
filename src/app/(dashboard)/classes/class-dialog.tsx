"use client";

import { useState, useTransition } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil } from "lucide-react";
import { GRADE_HE } from "@/lib/constants";

interface ClassDialogProps {
  teachers: { id: string; name: string }[];
  action: (data: FormData) => Promise<void>;
  title: string;
  defaultValues?: {
    name: string;
    grade: string;
    studentCount: string;
    homeroomTeacherId: string;
  };
  isEdit?: boolean;
}

export function ClassDialog({
  teachers,
  action,
  title,
  defaultValues,
  isEdit,
}: ClassDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
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
            <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
          ) : (
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /><span>הוספה</span></Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">שם כיתה</Label>
              <Input id="name" name="name" defaultValue={defaultValues?.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="grade">שכבה</Label>
              <select
                id="grade"
                name="grade"
                defaultValue={defaultValues?.grade || "7"}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                {Object.entries(GRADE_HE).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="studentCount">מספר תלמידים</Label>
              <Input
                id="studentCount"
                name="studentCount"
                type="number"
                min={0}
                dir="ltr"
                defaultValue={defaultValues?.studentCount || "0"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="homeroomTeacherId">מחנך/ת</Label>
              <select
                id="homeroomTeacherId"
                name="homeroomTeacherId"
                defaultValue={defaultValues?.homeroomTeacherId || ""}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">ללא</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-start">
            <Button type="submit" disabled={isPending}>
              {isPending ? "שומר..." : "שמירה"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
