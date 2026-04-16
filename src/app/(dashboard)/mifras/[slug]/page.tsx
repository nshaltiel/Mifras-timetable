import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default async function MifrasSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const page = await prisma.mifrasPage.findUnique({
    where: { slug, isPublished: true },
    include: {
      parent: { select: { slug: true, title: true } },
      children: { where: { isPublished: true }, orderBy: { order: "asc" } },
    },
  });

  if (!page) notFound();

  return (
    <div className="max-w-3xl space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/mifras" className="hover:text-foreground">מפרש</Link>
        {page.parent && (
          <>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href={`/mifras/${page.parent.slug}`} className="hover:text-foreground">{page.parent.title}</Link>
          </>
        )}
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">{page.title}</span>
      </div>

      <h1 className="text-2xl font-bold">{page.title}</h1>

      {/* Rich text content */}
      {page.content ? (
        <div
          className="prose prose-sm max-w-none dark:prose-invert [&_a]:text-primary [&_a]:underline [&_img]:rounded-lg [&_img]:max-w-full"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />
      ) : (
        <p className="text-muted-foreground">אין תוכן עדיין.</p>
      )}

      {/* Sub-pages */}
      {page.children.length > 0 && (
        <div className="mt-6 pt-4 border-t space-y-2">
          <h3 className="font-semibold text-sm text-muted-foreground">עמודים נוספים</h3>
          <div className="flex flex-wrap gap-2">
            {page.children.map(child => (
              <Link
                key={child.id}
                href={`/mifras/${child.slug}`}
                className="text-sm text-primary hover:underline"
              >
                {child.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
