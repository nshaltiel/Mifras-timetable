import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { RoomsClient } from "./rooms-client";

export default async function RoomsPage() {
  const session = await auth();
  const schoolId = (session?.user as Record<string, unknown>)?.schoolId as string;

  const [rooms, categories] = await Promise.all([
    prisma.room.findMany({
      where: { schoolId },
      include: { category: { select: { id: true, name: true, order: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.roomCategory.findMany({
      where: { schoolId },
      orderBy: { order: "asc" },
    }),
  ]);

  return <RoomsClient rooms={rooms} categories={categories} />;
}
