import { prisma } from "@/lib/prisma";
import { MifrasAdminClient } from "./mifras-admin-client";

type FlatPage = {
  id: string;
  slug: string;
  title: string;
  parentId: string | null;
  isPublished: boolean;
  order: number;
};

type NestedPage = FlatPage & { children: FlatPage[] };

export default async function AdminMifrasPage() {
  const rawPages = await prisma.mifrasPage.findMany({
    orderBy: [{ parentId: "asc" }, { order: "asc" }],
    select: { id: true, slug: true, title: true, parentId: true, isPublished: true, order: true },
  });

  // Build nested structure: top-level pages with their children
  const topLevel: NestedPage[] = rawPages
    .filter(p => !p.parentId)
    .map(p => ({ ...p, children: rawPages.filter(c => c.parentId === p.id) }));

  return <MifrasAdminClient pages={topLevel} />;
}
