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
import { Plus } from "lucide-react";

interface EntityDialogProps {
  title: string;
  trigger?: React.ReactElement;
  children: (props: { close: () => void; pending: boolean }) => React.ReactNode;
  action: (data: FormData) => Promise<void>;
}

export function EntityDialog({ title, trigger, children, action }: EntityDialogProps) {
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
          trigger || (
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
          {children({ close: () => setOpen(false), pending: isPending })}
        </form>
      </DialogContent>
    </Dialog>
  );
}
