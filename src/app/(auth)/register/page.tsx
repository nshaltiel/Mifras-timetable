"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerSchool } from "@/lib/registration-actions";
import Link from "next/link";
import { Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function RegisterPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isPending, startTransition] = useTransition();

  // Step 1 state
  const [schoolName, setSchoolName] = useState("");
  const [principalName, setPrincipalName] = useState("");
  const [principalPhone, setPrincipalPhone] = useState("");
  const [principalEmail, setPrincipalEmail] = useState("");
  const [principalPassword, setPrincipalPassword] = useState("");

  // Step 2 state
  const [extraUsers, setExtraUsers] = useState<
    { name: string; email: string; password: string }[]
  >([]);

  function addExtraUser() {
    setExtraUsers((prev) => [...prev, { name: "", email: "", password: "" }]);
  }

  function updateExtraUser(idx: number, field: string, value: string) {
    setExtraUsers((prev) =>
      prev.map((u, i) => (i === idx ? { ...u, [field]: value } : u))
    );
  }

  function removeExtraUser(idx: number) {
    setExtraUsers((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    setStep(2);
  }

  function handleSubmit() {
    startTransition(async () => {
      try {
        await registerSchool({
          schoolName,
          principalName,
          principalPhone,
          users: [
            {
              name: principalName,
              email: principalEmail,
              password: principalPassword,
              role: "ADMIN",
            },
            ...extraUsers
              .filter((u) => u.email && u.name && u.password)
              .map((u) => ({ ...u, role: "ADMIN" })),
          ],
        });
        setStep(3);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "שגיאה בהרשמה");
      }
    });
  }

  if (step === 3) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-10 space-y-4">
            <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <Check className="h-7 w-7 text-green-600" />
            </div>
            <h2 className="text-xl font-bold">ההרשמה הושלמה!</h2>
            <p className="text-muted-foreground text-sm">
              בית הספר <strong>{schoolName}</strong> נרשם בהצלחה. ניתן להיכנס
              עם המייל והסיסמה שהגדרת.
            </p>
            <Link href="/login">
              <Button className="w-full">התחבר למערכת</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Progress */}
        <div className="flex items-center gap-2 justify-center">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  step >= s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {s}
              </div>
              {s < 2 && (
                <div
                  className={`w-8 h-0.5 ${step > s ? "bg-primary" : "bg-muted"}`}
                />
              )}
            </div>
          ))}
        </div>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">פרטי בית הספר</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleStep1} className="space-y-3">
                <div className="space-y-1">
                  <Label>שם בית הספר *</Label>
                  <Input
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    required
                    placeholder="בית ספר..."
                  />
                </div>
                <div className="space-y-1">
                  <Label>שם המנהל *</Label>
                  <Input
                    value={principalName}
                    onChange={(e) => setPrincipalName(e.target.value)}
                    required
                    placeholder="שם מלא"
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
                <div className="space-y-1">
                  <Label>כתובת מייל לכניסה *</Label>
                  <Input
                    type="email"
                    value={principalEmail}
                    onChange={(e) => setPrincipalEmail(e.target.value)}
                    required
                    dir="ltr"
                    placeholder="admin@school.co.il"
                  />
                </div>
                <div className="space-y-1">
                  <Label>סיסמה *</Label>
                  <Input
                    type="password"
                    value={principalPassword}
                    onChange={(e) => setPrincipalPassword(e.target.value)}
                    required
                    dir="ltr"
                    minLength={6}
                    placeholder="לפחות 6 תווים"
                  />
                </div>
                <Button type="submit" className="w-full">
                  המשך
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  כבר רשומים?{" "}
                  <Link href="/login" className="text-primary hover:underline">
                    התחברות
                  </Link>
                </p>
              </form>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  משתמשים נוספים (אופציונלי)
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={addExtraUser}
                >
                  <Plus className="h-3.5 w-3.5" />
                  הוסף
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                הוסף עמיתים שיוכלו לנהל את המערכת עבור בית הספר
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {extraUsers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  ניתן להוסיף משתמשים נוספים גם לאחר הרשמה
                </p>
              )}
              {extraUsers.map((user, idx) => (
                <div key={idx} className="space-y-2 p-3 rounded-md border">
                  <div className="flex justify-between">
                    <p className="text-xs font-medium text-muted-foreground">
                      משתמש {idx + 1}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeExtraUser(idx)}
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
                          updateExtraUser(idx, "name", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>מייל</Label>
                      <Input
                        type="email"
                        dir="ltr"
                        value={user.email}
                        onChange={(e) =>
                          updateExtraUser(idx, "email", e.target.value)
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>סיסמה</Label>
                    <Input
                      type="password"
                      dir="ltr"
                      value={user.password}
                      onChange={(e) =>
                        updateExtraUser(idx, "password", e.target.value)
                      }
                    />
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleSubmit}
                  disabled={isPending}
                  className="flex-1"
                >
                  {isPending ? "רושם..." : "סיים הרשמה"}
                </Button>
                <Button variant="outline" onClick={() => setStep(1)}>
                  חזור
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
