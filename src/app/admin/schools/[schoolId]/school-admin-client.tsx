"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  resetUserPassword,
  addUserToSchool,
  removeUserFromSchool,
} from "@/lib/admin-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { KeyRound, Plus, Trash2, ArrowRight } from "lucide-react";
import Link from "next/link";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
}

interface School {
  id: string;
  name: string;
  principalName: string | null;
  principalPhone: string | null;
  users: User[];
  _count: { teachers: number; classes: number; rooms: number; subjects: number };
}

export function SchoolAdminClient({ school }: { school: School }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "ADMIN",
  });

  function openReset(userId: string) {
    setResetUserId(userId);
    setNewPassword("");
    setResetOpen(true);
  }

  function handleResetPassword() {
    startTransition(async () => {
      try {
        await resetUserPassword(resetUserId, newPassword);
        toast.success("הסיסמה עודכנה");
        setResetOpen(false);
      } catch {
        toast.error("שגיאה בעדכון הסיסמה");
      }
    });
  }

  function handleAddUser() {
    startTransition(async () => {
      try {
        await addUserToSchool(school.id, newUser);
        toast.success("המשתמש נוסף");
        setAddOpen(false);
        setNewUser({ name: "", email: "", password: "", role: "ADMIN" });
        router.refresh();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "שגיאה");
      }
    });
  }

  function handleRemoveUser(userId: string) {
    if (!confirm("האם למחוק משתמש זה?")) return;
    startTransition(async () => {
      try {
        await removeUserFromSchool(userId, school.id);
        toast.success("המשתמש הוסר");
        router.refresh();
      } catch {
        toast.error("שגיאה");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/admin"
          className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          בתי ספר
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{school.name}</h1>
        {school.principalName && (
          <p className="text-muted-foreground text-sm mt-1">
            מנהל: {school.principalName}
            {school.principalPhone && ` · ${school.principalPhone}`}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "מורים", val: school._count.teachers },
          { label: "כיתות", val: school._count.classes },
          { label: "חדרים", val: school._count.rooms },
          { label: "מקצועות", val: school._count.subjects },
        ].map(({ label, val }) => (
          <Card key={label}>
            <CardContent className="py-3 px-4 text-center">
              <p className="text-2xl font-bold">{val}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Users */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              משתמשים ({school.users.length})
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              הוסף משתמש
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {school.users.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 py-2 border-b last:border-0"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{user.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {user.role}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground" dir="ltr">
                  {user.email}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="איפוס סיסמה"
                  onClick={() => openReset(user.id)}
                >
                  <KeyRound className="h-3.5 w-3.5" />
                </Button>
                {school.users.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveUser(user.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Reset password dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>איפוס סיסמה</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>סיסמה חדשה</Label>
              <Input
                type="password"
                dir="ltr"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="לפחות 8 תווים"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleResetPassword}
                disabled={!newPassword || isPending}
              >
                אפס סיסמה
              </Button>
              <Button variant="outline" onClick={() => setResetOpen(false)}>
                ביטול
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add user dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>הוספת משתמש</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>שם</Label>
              <Input
                value={newUser.name}
                onChange={(e) =>
                  setNewUser((p) => ({ ...p, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>אימייל</Label>
              <Input
                type="email"
                dir="ltr"
                value={newUser.email}
                onChange={(e) =>
                  setNewUser((p) => ({ ...p, email: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>סיסמה ראשונית</Label>
              <Input
                type="password"
                dir="ltr"
                value={newUser.password}
                onChange={(e) =>
                  setNewUser((p) => ({ ...p, password: e.target.value }))
                }
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleAddUser}
                disabled={
                  !newUser.name ||
                  !newUser.email ||
                  !newUser.password ||
                  isPending
                }
              >
                הוסף
              </Button>
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                ביטול
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
