"use client";

import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {(session?.user as Record<string, unknown>)?.schoolName as string}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm">{session?.user?.name}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="gap-2"
        >
          <LogOut className="h-4 w-4" />
          <span>יציאה</span>
        </Button>
      </div>
    </header>
  );
}
