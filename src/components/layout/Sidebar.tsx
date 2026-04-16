import { prisma } from "@/lib/prisma";
import { SidebarClient } from "./SidebarClient";

export async function Sidebar() {
  const mifrasPages = await prisma.mifrasPage.findMany({
    select: { id: true, slug: true, title: true, parentId: true, isPublished: true },
    orderBy: [{ parentId: "asc" }, { order: "asc" }],
  });

  return <SidebarClient mifrasPages={mifrasPages} />;
}
