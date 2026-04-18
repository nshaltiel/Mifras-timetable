"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil } from "lucide-react";

interface TeacherDialogProps {
  subjects: { id: string; name: string }[];
  action: (data: FormData) => Promise<unknown>;
  title: string;
  defaultValues?: {
    name: string;
    email: string;
    phone: string;
    maxHoursPerWeek: string;
  };
  isEdit?: boolean;
}

export function TeacherDialog({
  action,
  title,
  defaultValues,
  isEdit,
}: TeacherDialogProps) {
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
            <Button variant="ghost" size="icon">
              <Pencil className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              <span>הוספה</span>
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">שם מלא</Label>
            <Input
              id="name"
              name="name"
              defaultValue={defaultValues?.name}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">אימייל</Label>
              <Input
                id="email"
                name="email"
                type="email"
                dir="ltr"
                defaultValue={defaultValues?.email}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">טלפון</Label>
              <Input
                id="phone"
                name="phone"
                dir="ltr"
                defaultValue={defaultValues?.phone}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxHoursPerWeek">שעות מקסימום בשבוע</Label>
            <Input
              id="maxHoursPerWeek"
              name="maxHoursPerWeek"
              type="number"
              min={1}
              dir="ltr"
              defaultValue={defaultValues?.maxHoursPerWeek}
            />
          </div>
          <div className="flex gap-2 justify-start">
            <Button type="submit" disabled={isPending}>
              {isPending ? "שומר..." : "שמירה"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              ביטול
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
