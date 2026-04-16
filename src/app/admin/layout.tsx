import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2, LogOut, Shield } from "lucide-react";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isSuperAdmin = (session?.user as Record<string, unknown>)?.isSuperAdmin;
  if (!isSuperAdmin) redirect("/login");

  return (
    <div className="min-h-screen bg-muted/20" dir="rtl">
      <header className="bg-background border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-primary" />
          <span className="font-bold text-lg">מנהל מערכת</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{session?.user?.name}</span>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button type="submit" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4" />
              יציאה
            </button>
          </form>
        </div>
      </header>
      <nav className="bg-background border-b px-6 py-2 flex gap-6 text-sm">
        <Link href="/admin" className="hover:text-primary font-medium">בתי ספר</Link>
        <Link href="/admin/schools/new" className="hover:text-primary">פתיחת בית ספר חדש</Link>
        <Link href="/admin/mifras" className="hover:text-primary">עמודי מפרש</Link>
        <Link href="/admin/super-admins" className="hover:text-primary flex items-center gap-1">
          <Shield className="h-3.5 w-3.5" />
          מנהלי מערכת
        </Link>
      </nav>
      <main className="max-w-6xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
