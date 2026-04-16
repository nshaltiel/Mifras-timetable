"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSuperAdmin, resetSuperAdminPassword, deleteSuperAdmin } from "@/lib/admin-actions";
import { KeyRound, Plus, Trash2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

type SuperAdmin = { id: string; email: string; name: string; createdAt: Date };

export function SuperAdminsClient({ superAdmins }: { superAdmins: SuperAdmin[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createError, setCreateError] = useState("");

  // Reset password dialog
  const [resetTarget, setResetTarget] = useState<SuperAdmin | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState("");

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<SuperAdmin | null>(null);
  const [deleteError, setDeleteError] = useState("");

  function handleCreate() {
    setCreateError("");
    startTransition(async () => {
      try {
        await createSuperAdmin({ name: createName, email: createEmail, password: createPassword });
        setShowCreate(false);
        setCreateName(""); setCreateEmail(""); setCreatePassword("");
        router.refresh();
      } catch (e) {
        setCreateError((e as Error).message);
      }
    });
  }

  function handleReset() {
    if (!resetTarget) return;
    setResetError("");
    startTransition(async () => {
      try {
        await resetSuperAdminPassword(resetTarget.id, resetPassword);
        setResetTarget(null);
        setResetPassword("");
        router.refresh();
      } catch (e) {
        setResetError((e as Error).message);
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError("");
    startTransition(async () => {
      try {
        await deleteSuperAdmin(deleteTarget.id);
        setDeleteTarget(null);
        router.refresh();
      } catch (e) {
        setDeleteError((e as Error).message);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">מנהלי מערכת</h1>
          <span className="text-sm text-muted-foreground">({superAdmins.length})</span>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          הוספת מנהל מערכת
        </Button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
        מנהלי מערכת אלו מייצגים את מפרש ויש להם גישה מלאה לכל בתי הספר, הגדרות המערכת ועמודי המידע.
      </div>

      <div className="bg-background border rounded-lg divide-y">
        {superAdmins.map((sa) => (
          <div key={sa.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="font-medium">{sa.name}</div>
              <div className="text-sm text-muted-foreground">{sa.email}</div>
              <div className="text-xs text-muted-foreground/70">
                נוצר: {new Date(sa.createdAt).toLocaleDateString("he-IL")}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setResetTarget(sa); setResetPassword(""); setResetError(""); }}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground border rounded px-2 py-1 hover:bg-muted transition-colors"
                title="איפוס סיסמה"
              >
                <KeyRound className="h-3.5 w-3.5" />
                איפוס סיסמה
              </button>
              <button
                onClick={() => { setDeleteTarget(sa); setDeleteError(""); }}
                className="flex items-center gap-1 text-sm text-destructive hover:text-destructive border border-destructive/20 rounded px-2 py-1 hover:bg-destructive/10 transition-colors"
                title="מחיקה"
              >
                <Trash2 className="h-3.5 w-3.5" />
                מחיקה
              </button>
            </div>
          </div>
        ))}
        {superAdmins.length === 0 && (
          <div className="px-4 py-8 text-center text-muted-foreground">אין מנהלי מערכת</div>
        )}
      </div>

      {/* Create dialog */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-background rounded-lg p-6 w-full max-w-sm space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">הוספת מנהל מערכת</h2>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">שם מלא</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  placeholder="ישראל ישראלי"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">כתובת מייל</label>
                <input
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  placeholder="user@mifras.org"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">סיסמה ראשונית</label>
                <input
                  type="password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  placeholder="מינימום 6 תווים"
                  dir="ltr"
                />
              </div>
              {createError && <p className="text-sm text-destructive">{createError}</p>}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCreate(false)}>ביטול</Button>
              <Button
                onClick={handleCreate}
                disabled={isPending || !createName || !createEmail || !createPassword}
              >
                הוספה
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password dialog */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setResetTarget(null)}>
          <div className="bg-background rounded-lg p-6 w-full max-w-sm space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">איפוס סיסמה</h2>
            <p className="text-sm text-muted-foreground">{resetTarget.name} ({resetTarget.email})</p>
            <div className="space-y-1">
              <label className="text-sm font-medium">סיסמה חדשה</label>
              <input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                placeholder="מינימום 6 תווים"
                dir="ltr"
                autoFocus
              />
            </div>
            {resetError && <p className="text-sm text-destructive">{resetError}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setResetTarget(null)}>ביטול</Button>
              <Button
                onClick={handleReset}
                disabled={isPending || resetPassword.length < 6}
              >
                שמור
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDeleteTarget(null)}>
          <div className="bg-background rounded-lg p-6 w-full max-w-sm space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-destructive">מחיקת מנהל מערכת</h2>
            <p className="text-sm">
              האם למחוק את <strong>{deleteTarget.name}</strong> ({deleteTarget.email})?
              פעולה זו אינה הפיכה.
            </p>
            {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>ביטול</Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isPending}
              >
                מחיקה
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
