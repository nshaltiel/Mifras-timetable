"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  CalendarDays, UserMinus, ArrowLeftRight, Settings,
  LayoutDashboard, ClipboardList, ChevronDown, BookOpen,
} from "lucide-react";
import { useState } from "react";

const coreNavItems = [
  { href: "/", label: "לוח בקרה", icon: LayoutDashboard },
  { href: "/timetable", label: "מערכת שעות", icon: CalendarDays },
  { href: "/hours-planning", label: "תכנון שעות", icon: ClipboardList },
  { href: "/absences", label: "היעדרויות", icon: UserMinus },
  { href: "/substitutions", label: "מילוי מקום", icon: ArrowLeftRight },
  { href: "/settings", label: "הגדרות", icon: Settings },
];

interface MifrasPage {
  id: string;
  slug: string;
  title: string;
  parentId: string | null;
  isPublished: boolean;
}

interface SidebarClientProps {
  mifrasPages: MifrasPage[];
}

export function SidebarClient({ mifrasPages }: SidebarClientProps) {
  const pathname = usePathname();
  const topLevelMifras = mifrasPages.filter(p => !p.parentId && p.isPublished);
  const [mifrasOpen, setMifrasOpen] = useState(pathname.startsWith("/mifras"));

  const isMifrasActive = pathname.startsWith("/mifras");

  return (
    <aside className="w-60 border-s border-border bg-sidebar flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <img
          src="/mifras-logo.png"
          alt="מפרש"
          className="h-18 w-auto object-contain"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {coreNavItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* מפרש section */}
        {topLevelMifras.length > 0 ? (
          <div>
            <button
              onClick={() => setMifrasOpen(!mifrasOpen)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isMifrasActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <BookOpen className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-start">מפרש</span>
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", mifrasOpen && "rotate-180")} />
            </button>
            {mifrasOpen && (
              <div className="ms-4 mt-0.5 space-y-0.5 border-s border-border ps-2">
                {topLevelMifras.map((page) => {
                  const children = mifrasPages.filter(p => p.parentId === page.id && p.isPublished);
                  const isPageActive = pathname === `/mifras/${page.slug}` || pathname.startsWith(`/mifras/${page.slug}/`);
                  return (
                    <div key={page.id}>
                      <Link
                        href={`/mifras/${page.slug}`}
                        className={cn(
                          "block px-2 py-1.5 rounded text-sm transition-colors",
                          isPageActive
                            ? "text-primary font-medium"
                            : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
                        )}
                      >
                        {page.title}
                      </Link>
                      {children.map(child => (
                        <Link
                          key={child.id}
                          href={`/mifras/${child.slug}`}
                          className={cn(
                            "block px-2 py-1.5 ps-4 rounded text-xs transition-colors",
                            pathname === `/mifras/${child.slug}`
                              ? "text-primary font-medium"
                              : "text-sidebar-foreground/50 hover:text-sidebar-foreground"
                          )}
                        >
                          {child.title}
                        </Link>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/mifras"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
              pathname.startsWith("/mifras")
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <BookOpen className="h-4 w-4 shrink-0" />
            <span>מפרש</span>
          </Link>
        )}
      </nav>
    </aside>
  );
}
