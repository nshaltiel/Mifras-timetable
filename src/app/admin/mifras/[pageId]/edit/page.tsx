import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { MifrasEditor } from "./mifras-editor";

export default async function EditMifrasPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  const page = await prisma.mifrasPage.findUnique({ where: { id: pageId } });
  if (!page) notFound();

  const allPages = await prisma.mifrasPage.findMany({
    select: { id: true, title: true, parentId: true },
    orderBy: { title: "asc" },
  });

  return <MifrasEditor page={page} allPages={allPages} />;
}
