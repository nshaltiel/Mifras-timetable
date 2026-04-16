"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSchoolWithAdmin } from "@/lib/admin-actions";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export default function NewSchoolPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [schoolName, setSchoolName] = useState("");
  const [principalName, setPrincipalName] = useState("");
  const [principalPhone, setPrincipalPhone] = useState("");
  const [principalEmail, setPrincipalEmail] = useState("");
  const [users, setUsers] = useState([{ name: "", email: "", password: "" }]);

  function addUser() {
    setUsers((prev) => [...prev, { name: "", email: "", password: "" }]);
  }

  function removeUser(idx: number) {
    setUsers((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateUser(idx: number, field: string, value: string) {
    setUsers((prev) =>
      prev.map((u, i) => (i === idx ? { ...u, [field]: value } : u))
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await createSchoolWithAdmin({
          schoolName,
          principalName,
          principalPhone,
          users: [
            {
              name: principalName,
              email: principalEmail,
              password: users[0]?.password || "",
              role: "ADMIN",
            },
            ...users.slice(1).map((u) => ({ ...u, role: "ADMIN" })),
          ].filter((u) => u.email && u.name),
        });
        toast.success("בית הספר נפתח בהצלחה");
        router.push("/admin");
      } catch (err: unknown) {
        toast.error(
          err instanceof Error ? err.message : "שגיאה ביצירת בית הספר"
        );
      }
    });
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">פתיחת בית ספר חדש</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">פרטי בית הספר</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>שם בית הספר *</Label>
              <Input
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                required
                placeholder="בית ספר אופק"
              />
            </div>
            <div className="space-y-1">
              <Label>שם המנהל *</Label>
              <Input
                value={principalName}
                onChange={(e) => setPrincipalName(e.target.value)}
                required
                placeholder="ישראל ישראלי"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>אימייל מנהל *</Label>
                <Input
                  type="email"
                  value={principalEmail}
                  onChange={(e) => setPrincipalEmail(e.target.value)}
                  required
                  dir="ltr"
                  placeholder="principal@school.co.il"
                />
              </div>
              <div className="space-y-1">
                <Label>טלפון נייד</Label>
                <Input
                  value={principalPhone}
                  onChange={(e) => setPrincipalPhone(e.target.value)}
                  placeholder="05x-xxxxxxx"
                  dir="ltr"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">משתמשי ניהול</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={addUser}
              >
                <Plus className="h-3.5 w-3.5" />
                הוסף משתמש
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* First user = principal */}
            <div className="space-y-2 p-3 rounded-md bg-muted/40">
              <p className="text-xs font-medium text-muted-foreground">
                מנהל ראשי (מייל מהשלב הקודם)
              </p>
              <div className="space-y-1">
                <Label>סיסמה ראשונית *</Label>
                <Input
                  type="password"
                  dir="ltr"
                  placeholder="לפחות 8 תווים"
                  value={users[0]?.password || ""}
                  onChange={(e) => updateUser(0, "password", e.target.value)}
                  required
                />
              </div>
            </div>
            {users.slice(1).map((user, idx) => (
              <div key={idx + 1} className="space-y-2 p-3 rounded-md border">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-medium text-muted-foreground">
                    משתמש {idx + 2}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeUser(idx + 1)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>שם</Label>
                    <Input
                      value={user.name}
                      onChange={(e) =>
                        updateUser(idx + 1, "name", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>אימייל</Label>
                    <Input
                      type="email"
                      dir="ltr"
                      value={user.email}
                      onChange={(e) =>
                        updateUser(idx + 1, "email", e.target.value)
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>סיסמה ראשונית</Label>
                  <Input
                    type="password"
                    dir="ltr"
                    value={user.password}
                    onChange={(e) =>
                      updateUser(idx + 1, "password", e.target.value)
                    }
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? "יוצר..." : "פתח בית ספר"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin")}
          >
            ביטול
          </Button>
        </div>
      </form>
    </div>
  );
}
