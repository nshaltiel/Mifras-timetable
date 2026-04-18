"use client";

import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

const routeLabels: Record<string, { title: string; subtitle?: string }> = {
  "/": { title: "לוח בקרה" },
  "/timetable": { title: "מערכת שעות" },
  "/absences": { title: "היעדרויות" },
  "/substitutions": { title: "מילוי מקום" },
  "/hours-planning": { title: "תכנון שעות" },
  "/teachers": { title: "מורים" },
  "/subjects": { title: "מקצועות" },
  "/classes": { title: "כיתות" },
  "/rooms": { title: "חדרים" },
  "/settings": { title: "הגדרות" },
  "/study-groups": { title: "קבוצות לימוד" },
  "/mifras": { title: "מפרש" },
};

function resolveRoute(pathname: string) {
  if (routeLabels[pathname]) return routeLabels[pathname];
  // Match prefix
  for (const [route, meta] of Object.entries(routeLabels)) {
    if (route !== "/" && pathname.startsWith(route)) return meta;
  }
  return { title: "" };
}

export function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { title } = resolveRoute(pathname);
  const schoolName = (session?.user as Record<string, unknown>)?.schoolName as string | undefined;

  return (
    <header className="h-[60px] border-b border-mifras-ink-100 bg-white flex items-center justify-between px-6 shrink-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13.5px]">
        {schoolName ? (
          <>
            <span className="text-mifras-ink-400">{schoolName}</span>
            {title && (
              <>
                <span className="text-mifras-ink-200">·</span>
                <span className="font-semibold text-mifras-navy-700">{title}</span>
              </>
            )}
          </>
        ) : (
          <span className="font-semibold text-mifras-navy-700">{title}</span>
        )}
      </div>

      {/* User + sign-out */}
      <div className="flex items-center gap-3">
        <span className="text-[13.5px] text-mifras-ink-700 font-medium">
          {session?.user?.name}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="gap-1.5 text-mifras-ink-500 hover:text-mifras-danger"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>יציאה</span>
        </Button>
      </div>
    </header>
  );
}
