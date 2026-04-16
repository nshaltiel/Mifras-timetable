"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function requireSuperAdmin() {
  const session = await auth();
  const isSuperAdmin = (session?.user as Record<string, unknown>)?.isSuperAdmin;
  if (!isSuperAdmin) throw new Error("Unauthorized");
}

export async function getMifrasPages() {
  return prisma.mifrasPage.findMany({
    orderBy: [{ parentId: "asc" }, { order: "asc" }, { createdAt: "asc" }],
    include: { children: { orderBy: { order: "asc" } } },
  });
}

export async function getMifrasPage(slug: string) {
  return prisma.mifrasPage.findUnique({ where: { slug } });
}

export async function createMifrasPage(data: {
  title: string;
  slug: string;
  content?: string;
  parentId?: string | null;
  order?: number;
}) {
  await requireSuperAdmin();
  if (!data.title?.trim()) throw new Error("כותרת חובה");
  if (!data.slug?.trim()) throw new Error("slug חובה");
  // Slugify: lowercase, no spaces
  const slug = data.slug.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  await prisma.mifrasPage.create({
    data: {
      title: data.title.trim(),
      slug,
      content: data.content ?? "",
      parentId: data.parentId ?? null,
      order: data.order ?? 0,
    },
  });
  revalidatePath("/mifras");
  revalidatePath("/admin/mifras");
}

export async function updateMifrasPage(id: string, data: {
  title?: string;
  content?: string;
  isPublished?: boolean;
  order?: number;
}) {
  await requireSuperAdmin();
  await prisma.mifrasPage.update({ where: { id }, data });
  revalidatePath("/mifras");
  revalidatePath("/admin/mifras");
}

export async function deleteMifrasPage(id: string) {
  await requireSuperAdmin();
  // Unparent children first
  await prisma.mifrasPage.updateMany({ where: { parentId: id }, data: { parentId: null } });
  await prisma.mifrasPage.delete({ where: { id } });
  revalidatePath("/mifras");
  revalidatePath("/admin/mifras");
}
