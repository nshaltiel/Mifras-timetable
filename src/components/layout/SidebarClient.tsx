"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, CalendarDays, UserMinus, ArrowLeftRight,
  ClipboardList, Users, BookOpen, GraduationCap, DoorOpen,
  Settings, BookOpenText, ChevronDown,
} from "lucide-react";
import { useState } from "react";

const managementNav = [
  { href: "/", label: "לוח בקרה", icon: LayoutDashboard, exact: true },
  { href: "/timetable", label: "מערכת שעות", icon: CalendarDays },
  { href: "/absences", label: "היעדרויות", icon: UserMinus },
  { href: "/substitutions", label: "מילוי מקום", icon: ArrowLeftRight },
];

const setupNav = [
  { href: "/hours-planning", label: "תכנון שעות", icon: ClipboardList },
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

function NavItem({
  href,
  label,
  icon: Icon,
  exact,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] text-[13.5px] transition-colors duration-150",
        isActive
          ? "bg-mifras-navy-50 text-mifras-navy-700 font-semibold [&_svg]:text-mifras-orange-500"
          : "text-mifras-ink-500 hover:bg-mifras-navy-50 hover:text-mifras-navy-700 font-medium"
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-2.5 py-1 mt-4 mb-1 text-[11px] font-semibold text-mifras-ink-400 tracking-wide"
      style={{ letterSpacing: "0.03em" }}
    >
      {children}
    </div>
  );
}

export function SidebarClient({ mifrasPages }: SidebarClientProps) {
  const pathname = usePathname();
  const topLevelMifras = mifrasPages.filter((p) => !p.parentId && p.isPublished);
  const [mifrasOpen, setMifrasOpen] = useState(pathname.startsWith("/mifras"));
  const isMifrasActive = pathname.startsWith("/mifras");

  return (
    <aside className="w-60 border-s border-mifras-ink-100 bg-white flex flex-col h-full shadow-mifras-xs">
      {/* Logo */}
      <div className="px-4 py-3.5 border-b border-mifras-ink-100">
        <Image
          src="/brand/logo.png"
          alt="מפרש"
          width={192}
          height={80}
          className="h-20 w-auto object-contain"
        />
      </div>

      <nav className="flex-1 px-2 pb-4 overflow-y-auto">
        {/* ניהול */}
        <SectionLabel>ניהול</SectionLabel>
        <div className="space-y-0.5">
          {managementNav.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </div>

        {/* הקמה */}
        <div className="space-y-0.5 mt-0.5">
          {setupNav.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </div>

        {/* מפרש CMS section */}
        {topLevelMifras.length > 0 && (
          <>
            <SectionLabel>מפרש</SectionLabel>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => setMifrasOpen(!mifrasOpen)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] text-[13.5px] transition-colors duration-150 font-medium",
                  isMifrasActive
                    ? "bg-mifras-navy-50 text-mifras-navy-700 font-semibold"
                    : "text-mifras-ink-500 hover:bg-mifras-navy-50 hover:text-mifras-navy-700"
                )}
              >
                <BookOpenText className="size-4 shrink-0" />
                <span className="flex-1 text-start">תוכן מפרש</span>
                <ChevronDown
                  className={cn(
                    "size-3.5 text-mifras-ink-400 transition-transform duration-150",
                    mifrasOpen && "rotate-180"
                  )}
                />
              </button>
              {mifrasOpen && (
                <div className="ms-4 mt-0.5 space-y-0.5 border-s border-mifras-ink-100 ps-2">
                  {topLevelMifras.map((page) => {
                    const children = mifrasPages.filter(
                      (p) => p.parentId === page.id && p.isPublished
                    );
                    const isPageActive =
                      pathname === `/mifras/${page.slug}` ||
                      pathname.startsWith(`/mifras/${page.slug}/`);
                    return (
                      <div key={page.id}>
                        <Link
                          href={`/mifras/${page.slug}`}
                          className={cn(
                            "block px-2 py-1.5 rounded text-[13px] transition-colors",
                            isPageActive
                              ? "text-mifras-orange-600 font-semibold"
                              : "text-mifras-ink-500 hover:text-mifras-navy-700"
                          )}
                        >
                          {page.title}
                        </Link>
                        {children.map((child) => (
                          <Link
                            key={child.id}
                            href={`/mifras/${child.slug}`}
                            className={cn(
                              "block px-2 py-1.5 ps-4 rounded text-[12px] transition-colors",
                              pathname === `/mifras/${child.slug}`
                                ? "text-mifras-orange-600 font-medium"
                                : "text-mifras-ink-400 hover:text-mifras-navy-700"
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
          </>
        )}
      </nav>

      {/* User footer */}
      <UserFooter />
    </aside>
  );
}

function UserFooter() {
  return (
    <div className="border-t border-mifras-ink-100 px-4 py-3 flex items-center gap-3">
      <div className="size-8 rounded-full bg-mifras-navy-50 flex items-center justify-center text-mifras-navy-700 text-[13px] font-semibold shrink-0">
        מ
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-mifras-ink-900 truncate">מנהל בית ספר</div>
        <div className="text-[11.5px] text-mifras-ink-400 truncate">ניהול מערכת</div>
      </div>
    </div>
  );
}
