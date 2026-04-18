"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody } from "@/components/ui/panel";
import { PillTabs } from "@/components/ui/pill-tabs";
import { Chip } from "@/components/ui/mifras-chip";
import { EntityDialog } from "@/components/ui/entity-dialog";
import { DeleteButton } from "@/components/ui/delete-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, BookOpen } from "lucide-react";
import { createSubject, deleteSubject, updateSubject } from "@/lib/actions";
import { SUBJECT_CATEGORY_HE } from "@/lib/constants";

type Tone = "navy" | "accent" | "gold" | "sky" | "ghost";

const CATEGORY_TONE: Record<string, Tone> = {
  core: "navy",
  elective: "accent",
  enrichment: "gold",
  homeroom: "sky",
};

interface Subject {
  id: string;
  name: string;
  category: string | null;
  color: string | null;
  _count: { teachers: number };
}

function SubjectForm({ defaultValues, pending }: {
  defaultValues?: { name: string; category: string; color: string };
  pending: boolean;
  close: () => void;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="name">שם מקצוע</Label>
        <Input id="name" name="name" defaultValue={defaultValues?.name} required
          className="border-mifras-ink-200 focus:border-mifras-orange-500" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="category">קטגוריה</Label>
          <select id="category" name="category" defaultValue={defaultValues?.category || ""}
            className="flex h-9 w-full rounded-md border border-mifras-ink-200 bg-transparent px-3 py-1 text-[13.5px] focus:outline-none focus:border-mifras-orange-500">
            <option value="">ללא</option>
            {Object.entries(SUBJECT_CATEGORY_HE).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="color">צבע</Label>
          <Input id="color" name="color" type="color"
            defaultValue={defaultValues?.color || "#4d90fe"}
            className="h-9 p-1 border-mifras-ink-200" />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={pending}>{pending ? "שומר..." : "שמירה"}</Button>
      </div>
    </>
  );
}

export function SubjectsClient({ subjects }: { subjects: Subject[] }) {
  const [activeCategory, setActiveCategory] = useState("all");

  // Count per category
  const counts: Record<string, number> = { all: subjects.length };
  for (const s of subjects) {
    const cat = s.category || "none";
    counts[cat] = (counts[cat] ?? 0) + 1;
  }

  const tabItems = [
    { value: "all", label: `הכל`, count: counts.all },
    ...Object.entries(SUBJECT_CATEGORY_HE).map(([val, label]) => ({
      value: val,
      label,
      count: counts[val] ?? 0,
    })),
  ];

  const filtered = activeCategory === "all"
    ? subjects
    : subjects.filter((s) => s.category === activeCategory);

  return (
    <div className="space-y-5">
      <PageHeader
        title="מקצועות"
        subtitle={`${subjects.length} מקצועות`}
        actions={
          <EntityDialog title="הוספת מקצוע" action={createSubject}>
            {(props) => <SubjectForm {...props} />}
          </EntityDialog>
        }
      />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <PillTabs items={tabItems} value={activeCategory} onChange={setActiveCategory} />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-mifras-ink-400">
          <BookOpen className="size-10 mx-auto mb-3 opacity-30" />
          <p className="text-[13.5px]">אין מקצועות בקטגוריה זו</p>
        </div>
      ) : (
        <Panel>
          <PanelBody className="p-0 overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-mifras-paper border-b border-mifras-ink-100">
                  {["", "שם", "קטגוריה", "מורים", ""].map((h, i) => (
                    <th key={i} className="text-start px-4 py-3 font-semibold text-mifras-navy-700 text-[12px]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-mifras-ink-100">
                {filtered.map((subject) => (
                  <tr key={subject.id} className="hover:bg-mifras-ink-50 transition-colors">
                    <td className="px-4 py-3 w-10">
                      <div
                        className="size-5 rounded-[4px]"
                        style={{ backgroundColor: subject.color || "#4d90fe" }}
                      />
                    </td>
                    <td className="px-4 py-3 font-semibold text-mifras-ink-900">{subject.name}</td>
                    <td className="px-4 py-3">
                      {subject.category ? (
                        <Chip tone={CATEGORY_TONE[subject.category] ?? "ghost"}>
                          {SUBJECT_CATEGORY_HE[subject.category] || subject.category}
                        </Chip>
                      ) : (
                        <span className="text-mifras-ink-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-mifras-ink-500">{subject._count.teachers} מורים</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <EntityDialog
                          title="עריכת מקצוע"
                          action={updateSubject.bind(null, subject.id)}
                          trigger={
                            <Button variant="ghost" size="icon" className="size-7">
                              <Pencil className="size-3.5" />
                            </Button>
                          }
                        >
                          {(props) => (
                            <SubjectForm
                              {...props}
                              defaultValues={{
                                name: subject.name,
                                category: subject.category || "",
                                color: subject.color || "#4d90fe",
                              }}
                            />
                          )}
                        </EntityDialog>
                        <DeleteButton action={deleteSubject.bind(null, subject.id)} entityName={subject.name} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PanelBody>
        </Panel>
      )}
    </div>
  );
}
