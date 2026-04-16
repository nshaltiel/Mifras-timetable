import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createSubject, deleteSubject, updateSubject } from "@/lib/actions";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SUBJECT_CATEGORY_HE } from "@/lib/constants";
import { EntityDialog } from "@/components/ui/entity-dialog";
import { DeleteButton } from "@/components/ui/delete-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

function SubjectForm({
  defaultValues,
  pending,
}: {
  defaultValues?: { name: string; category: string; color: string };
  pending: boolean;
  close: () => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="name">שם מקצוע</Label>
        <Input id="name" name="name" defaultValue={defaultValues?.name} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">קטגוריה</Label>
          <select
            id="category"
            name="category"
            defaultValue={defaultValues?.category || ""}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            <option value="">ללא</option>
            {Object.entries(SUBJECT_CATEGORY_HE).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="color">צבע</Label>
          <Input
            id="color"
            name="color"
            type="color"
            defaultValue={defaultValues?.color || "#4d90fe"}
            className="h-9 p-1"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-start">
        <Button type="submit" disabled={pending}>
          {pending ? "שומר..." : "שמירה"}
        </Button>
      </div>
    </>
  );
}

export default async function SubjectsPage() {
  const session = await auth();
  const schoolId = (session?.user as Record<string, unknown>)?.schoolId as string;

  const subjects = await prisma.subject.findMany({
    where: { schoolId },
    include: { _count: { select: { teachers: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">מקצועות</h2>
        <EntityDialog title="הוספת מקצוע" action={createSubject}>
          {(props) => <SubjectForm {...props} />}
        </EntityDialog>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>צבע</TableHead>
              <TableHead>שם</TableHead>
              <TableHead>קטגוריה</TableHead>
              <TableHead>מורים</TableHead>
              <TableHead className="w-20">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  אין מקצועות עדיין. לחצו על &quot;הוספה&quot; כדי להתחיל.
                </TableCell>
              </TableRow>
            ) : (
              subjects.map((subject) => (
                <TableRow key={subject.id}>
                  <TableCell>
                    <div
                      className="h-4 w-4 rounded-full"
                      style={{ backgroundColor: subject.color || "#4d90fe" }}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{subject.name}</TableCell>
                  <TableCell>
                    {subject.category ? (
                      <Badge variant="secondary">
                        {SUBJECT_CATEGORY_HE[subject.category] || subject.category}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{subject._count.teachers}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <EntityDialog
                        title="עריכת מקצוע"
                        action={updateSubject.bind(null, subject.id)}
                        trigger={
                          <Button variant="ghost" size="icon">
                            <Pencil className="h-4 w-4" />
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
                      <DeleteButton
                        action={deleteSubject.bind(null, subject.id)}
                        entityName={subject.name}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
