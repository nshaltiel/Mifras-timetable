"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { PillTabs } from "@/components/ui/pill-tabs";
import { Chip } from "@/components/ui/mifras-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeleteButton } from "@/components/ui/delete-button";
import { EntityDialog } from "@/components/ui/entity-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus, Pencil, DoorOpen, FlaskConical, Monitor, Dumbbell, Mic2,
  Settings2, Building2,
} from "lucide-react";
import { toast } from "sonner";
import { createRoom, updateRoom, deleteRoom, createRoomCategory, updateRoomCategory, deleteRoomCategory } from "@/lib/actions";
import { ROOM_TYPE_HE } from "@/lib/constants";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface RoomCategory { id: string; name: string; order: number }
interface Room {
  id: string;
  name: string;
  capacity: number;
  type: string;
  maxConcurrentClasses: number;
  categoryId: string | null;
  category: RoomCategory | null;
}

// ─── Color + icon mapping by legacy type ──────────────────────────────────────

const TYPE_GRADIENT: Record<string, string> = {
  REGULAR: "from-mifras-navy-50 to-sky-100",
  LAB:     "from-emerald-50 to-emerald-100",
  COMPUTER:"from-mifras-gold-50 to-yellow-100",
  GYM:     "from-orange-50 to-orange-100",
  AUDITORIUM: "from-purple-50 to-violet-100",
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  REGULAR: <DoorOpen className="size-9 opacity-40" />,
  LAB:     <FlaskConical className="size-9 opacity-40" />,
  COMPUTER:<Monitor className="size-9 opacity-40" />,
  GYM:     <Dumbbell className="size-9 opacity-40" />,
  AUDITORIUM: <Mic2 className="size-9 opacity-40" />,
};

const TYPE_CHIP_TONE: Record<string, "navy" | "gold" | "sky" | "success" | "ghost"> = {
  REGULAR: "navy",
  LAB:     "success",
  COMPUTER:"gold",
  GYM:     "accent" as "navy",
  AUDITORIUM: "ghost",
};

// ─── Room Form ─────────────────────────────────────────────────────────────────

function RoomForm({
  defaultValues, pending, categories,
}: {
  defaultValues?: { name: string; capacity: string; type: string; maxConcurrentClasses: string; categoryId: string };
  pending: boolean;
  close: () => void;
  categories: RoomCategory[];
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="name">שם חדר</Label>
        <Input id="name" name="name" defaultValue={defaultValues?.name} required
          className="border-mifras-ink-200 focus:border-mifras-orange-500" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="capacity">קיבולת תלמידים</Label>
          <Input id="capacity" name="capacity" type="number" min={0} dir="ltr"
            defaultValue={defaultValues?.capacity || "35"}
            className="border-mifras-ink-200 focus:border-mifras-orange-500" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="type">סוג</Label>
          <select id="type" name="type" defaultValue={defaultValues?.type || "REGULAR"}
            className="flex h-9 w-full rounded-md border border-mifras-ink-200 bg-transparent px-3 py-1 text-[13.5px] focus:outline-none focus:border-mifras-orange-500">
            {Object.entries(ROOM_TYPE_HE).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      </div>
      {categories.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="categoryId">קטגוריה</Label>
          <select id="categoryId" name="categoryId" defaultValue={defaultValues?.categoryId || ""}
            className="flex h-9 w-full rounded-md border border-mifras-ink-200 bg-transparent px-3 py-1 text-[13.5px] focus:outline-none focus:border-mifras-orange-500">
            <option value="">ללא קטגוריה</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="maxConcurrentClasses">מקסימום כיתות בו-זמנית</Label>
        <Input id="maxConcurrentClasses" name="maxConcurrentClasses" type="number" min={1} max={10} dir="ltr"
          defaultValue={defaultValues?.maxConcurrentClasses || "1"}
          className="border-mifras-ink-200 focus:border-mifras-orange-500" />
        <p className="text-[12px] text-mifras-ink-400">לרוב: 1. לאולם / ספרייה: 2 ומעלה.</p>
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={pending}>{pending ? "שומר..." : "שמירה"}</Button>
      </div>
    </>
  );
}

// ─── Category Management Dialog ────────────────────────────────────────────────

function CategoryManagerDialog({ categories }: { categories: RoomCategory[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");

  function handleCreate() {
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        await createRoomCategory({ name: name.trim() });
        toast.success("קטגוריה נוצרה");
        setName("");
        router.refresh();
      } catch { toast.error("שגיאה ביצירה"); }
    });
  }

  return (
    <>
      <Button variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <Settings2 className="size-3.5" />
        ניהול קטגוריות
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>קטגוריות חדרים</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="שם קטגוריה חדשה"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="border-mifras-ink-200 focus:border-mifras-orange-500"
              />
              <Button onClick={handleCreate} disabled={isPending || !name.trim()} size="sm">
                <Plus className="size-3.5" />
              </Button>
            </div>
            <div className="space-y-1.5">
              {categories.length === 0 && (
                <p className="text-[13px] text-mifras-ink-400 text-center py-3">אין קטגוריות עדיין</p>
              )}
              {categories.map((cat) => (
                <div key={cat.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border border-mifras-ink-100 bg-mifras-paper">
                  <span className="text-[13.5px] font-medium text-mifras-ink-900">{cat.name}</span>
                  <div className="flex gap-1">
                    <DeleteButton
                      action={deleteRoomCategory.bind(null, cat.id)}
                      entityName={cat.name}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Room Card ─────────────────────────────────────────────────────────────────

function RoomCard({ room, categories }: { room: Room; categories: RoomCategory[] }) {
  const gradient = TYPE_GRADIENT[room.type] ?? "from-mifras-navy-50 to-sky-100";
  const icon = TYPE_ICON[room.type] ?? <Building2 className="size-9 opacity-40" />;
  const chipTone = (TYPE_CHIP_TONE[room.type] as "navy" | "accent" | "gold" | "sky" | "ghost") ?? "ghost";
  const label = ROOM_TYPE_HE[room.type] || room.type;
  const catName = room.category?.name;

  return (
    <div className="rounded-[14px] border border-mifras-ink-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col">
      {/* Tinted top band */}
      <div className={`h-[90px] bg-gradient-to-br ${gradient} flex items-center justify-center text-mifras-navy-600`}>
        {icon}
      </div>
      {/* Body */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="font-bold text-[15px] text-mifras-ink-900 leading-tight">{room.name}</span>
          <Chip tone={chipTone as "navy" | "accent" | "gold" | "sky" | "ghost"}>{catName || label}</Chip>
        </div>
        <p className="text-[12.5px] text-mifras-ink-400">
          קיבולת: {room.capacity} תלמידים
          {room.maxConcurrentClasses > 1 && ` · עד ${room.maxConcurrentClasses} כיתות`}
        </p>
      </div>
      {/* Actions strip */}
      <div className="border-t border-dashed border-mifras-ink-100 px-4 py-2 flex justify-end gap-1">
        <EntityDialog
          title="עריכת חדר"
          action={updateRoom.bind(null, room.id)}
          trigger={
            <Button variant="ghost" size="icon" className="size-7">
              <Pencil className="size-3.5" />
            </Button>
          }
        >
          {(props) => (
            <RoomForm
              {...props}
              categories={categories}
              defaultValues={{
                name: room.name,
                capacity: room.capacity.toString(),
                type: room.type,
                maxConcurrentClasses: room.maxConcurrentClasses.toString(),
                categoryId: room.categoryId || "",
              }}
            />
          )}
        </EntityDialog>
        <DeleteButton action={deleteRoom.bind(null, room.id)} entityName={room.name} />
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

interface RoomsClientProps {
  rooms: Room[];
  categories: RoomCategory[];
}

export function RoomsClient({ rooms, categories }: RoomsClientProps) {
  const [activeType, setActiveType] = useState("all");

  // Count by type
  const counts: Record<string, number> = { all: rooms.length };
  for (const r of rooms) {
    counts[r.type] = (counts[r.type] ?? 0) + 1;
  }

  const tabItems = [
    { value: "all", label: "הכל", count: rooms.length },
    ...Object.entries(ROOM_TYPE_HE)
      .filter(([val]) => (counts[val] ?? 0) > 0)
      .map(([val, label]) => ({ value: val, label, count: counts[val] ?? 0 })),
  ];

  const filtered = activeType === "all"
    ? rooms
    : rooms.filter((r) => r.type === activeType);

  return (
    <div className="space-y-5">
      <PageHeader
        title="חדרים"
        subtitle={`${rooms.length} חדרים`}
        actions={
          <div className="flex gap-2">
            <CategoryManagerDialog categories={categories} />
            <EntityDialog title="הוספת חדר" action={createRoom}>
              {(props) => <RoomForm {...props} categories={categories} />}
            </EntityDialog>
          </div>
        }
      />

      {rooms.length === 0 ? (
        <div className="text-center py-20 text-mifras-ink-400">
          <Building2 className="size-12 mx-auto mb-3 opacity-30" />
          <p className="text-[14px]">אין חדרים עדיין. לחצו על &quot;הוספת חדר&quot; כדי להתחיל.</p>
        </div>
      ) : (
        <>
          <PillTabs items={tabItems} value={activeType} onChange={setActiveType} />
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
          >
            {filtered.map((room) => (
              <RoomCard key={room.id} room={room} categories={categories} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
