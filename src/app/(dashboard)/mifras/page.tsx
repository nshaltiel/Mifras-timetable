import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { BookOpen } from "lucide-react";

export default async function MifrasPage() {
  const pages = await prisma.mifrasPage.findMany({
    where: { parentId: null, isPublished: true },
    orderBy: { order: "asc" },
  });

  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
        <BookOpen className="h-12 w-12 mb-4 opacity-30" />
        <p className="text-lg font-medium">אין תוכן זמין עדיין</p>
        <p className="text-sm mt-1">מנהל המערכת לא פרסם תוכן עדיין.</p>
      </div>
    );
  }

  // If there's only one top-level page, redirect to it
  if (pages.length === 1) {
    const { redirect } = await import("next/navigation");
    redirect(`/mifras/${pages[0].slug}`);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">מפרש</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {pages.map(page => (
          <Link key={page.id} href={`/mifras/${page.slug}`}>
            <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full">
              <CardContent className="py-4 px-5">
                <h3 className="font-semibold">{page.title}</h3>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
