"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, UsersRound } from "lucide-react";
import { createStudyGroup, deleteStudyGroup } from "@/lib/study-group-actions";
import { updateStudyGroup } from "@/lib/scheduling-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Teacher {
  id: string;
  name: string;
  subjects: { subject: { id: string } }[];
}

interface Class {
  id: string;
  name: string;
  grade: number;
}

interface Subject {
  id: string;
  name: string;
  color: string | null;
}

interface StudyGroup {
  id: string;
  name: string;
  level: string | null;
  subject: { id: string; name: string; color: string | null };
  teacher: { id: string; name: string };
  classes: { class: { id: string; name: string; grade: number } }[];
}

interface Props {
  groups: StudyGroup[];
  teachers: Teacher[];
  classes: Class[];
  subjects: Subject[];
}

export function StudyGroupsClient({ groups, teachers, classes, subjects }: Props) {
  const [open, setOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<StudyGroup | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Form state
  const [name, setName] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [level, setLevel] = useState("רגיל");
  const [teacherId, setTeacherId] = useState("");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);

  function openCreate() {
    setEditingGroup(null);
    setName(""); setSubjectId(""); setLevel("רגיל"); setTeacherId(""); setSelectedClassIds([]);
    setOpen(true);
  }

  function openEdit(group: StudyGroup) {
    setEditingGroup(group);
    setName(group.name);
    setSubjectId(group.subject.id);
    setLevel(group.level ?? "רגיל");
    setTeacherId(group.teacher.id);
    setSelectedClassIds(group.classes.map(({ class: c }) => c.id));
    setOpen(true);
  }

  const filteredTeachers = subjectId
    ? teachers.filter((t) => t.subjects.some((ts) => ts.subject.id === subjectId))
    : teachers;

  function toggleClass(classId: string) {
    setSelectedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  }

  function handleSave() {
    if (!name || !subjectId || !teacherId || selectedClassIds.length === 0) return;
    startTransition(async () => {
      try {
        if (editingGroup) {
          await updateStudyGroup(editingGroup.id, { name, subjectId, level, teacherId, classIds: selectedClassIds });
          toast.success("קבוצת הלימוד עודכנה");
        } else {
          await createStudyGroup({ name, subjectId, level, teacherId, classIds: selectedClassIds });
          toast.success("קבוצת הלימוד נוצרה בהצלחה");
        }
        setOpen(false);
        setEditingGroup(null);
        setName(""); setSubjectId(""); setLevel("רגיל"); setTeacherId(""); setSelectedClassIds([]);
        router.refresh();
      } catch {
        toast.error(editingGroup ? "שגיאה בעדכון" : "שגיאה ביצירת קבוצת הלימוד");
      }
    });
  }

  function handleDelete(id: string, groupName: string) {
    if (!confirm(`האם למחוק את קבוצת הלימוד "${groupName}"?`)) return;
    startTransition(async () => {
      try {
        await deleteStudyGroup(id);
        toast.success("קבוצת הלימוד נמחקה");
        router.refresh();
      } catch {
        toast.error("שגיאה במחיקת קבוצת הלימוד");
      }
    });
  }

  const classesByGrade = classes.reduce<Record<number, Class[]>>((acc, cls) => {
    acc[cls.grade] = acc[cls.grade] || [];
    acc[cls.grade].push(cls);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          קבוצה חדשה
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingGroup ? "עריכת קבוצת לימוד" : "יצירת קבוצת לימוד חדשה"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>שם הקבוצה</Label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="לדוגמה: מתמטיקה מגברת ח'1-3"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>מקצוע</Label>
                  <select
                    value={subjectId}
                    onChange={(e) => { setSubjectId(e.target.value); setTeacherId(""); }}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  >
                    <option value="">בחר מקצוע</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>רמה</Label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  >
                    <option value="רגיל">רגיל</option>
                    <option value="מגברת">מגברת</option>
                    <option value="מחוזקת">מחוזקת</option>
                    <option value="בסיסי">בסיסי</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label>מורה</Label>
                <select
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">בחר מורה</option>
                  {filteredTeachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label>כיתות משתתפות</Label>
                <div className="border border-input rounded-md p-2 space-y-2 max-h-48 overflow-y-auto">
                  {Object.entries(classesByGrade)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([grade, gradeClasses]) => (
                      <div key={grade}>
                        <p className="text-xs text-muted-foreground mb-1">כיתות {grade}</p>
                        <div className="flex flex-wrap gap-1">
                          {gradeClasses.map((cls) => (
                            <button
                              key={cls.id}
                              type="button"
                              onClick={() => toggleClass(cls.id)}
                              className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                                selectedClassIds.includes(cls.id)
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "border-input hover:bg-muted"
                              }`}
                            >
                              {cls.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
                {selectedClassIds.length > 0 && (
                  <p className="text-xs text-muted-foreground">{selectedClassIds.length} כיתות נבחרו</p>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  onClick={handleSave}
                  disabled={!name || !subjectId || !teacherId || selectedClassIds.length === 0 || isPending}
                >
                  {isPending ? "שומר..." : editingGroup ? "שמור" : "צור קבוצה"}
                </Button>
                <Button variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <UsersRound className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>אין קבוצות לימוד. צור קבוצה חדשה להתחיל.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Card key={group.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-start justify-between gap-2">
                  <span>{group.name}</span>
                  <div className="flex gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(group)}
                      disabled={isPending}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(group.id, group.name)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {group.subject.color && (
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: group.subject.color }}
                    />
                  )}
                  <span className="text-sm font-medium">{group.subject.name}</span>
                  {group.level && <Badge variant="secondary" className="text-xs">{group.level}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">מורה: {group.teacher.name}</p>
                <div className="flex flex-wrap gap-1">
                  {group.classes.map(({ class: cls }) => (
                    <Badge key={cls.id} variant="outline" className="text-xs">{cls.name}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
