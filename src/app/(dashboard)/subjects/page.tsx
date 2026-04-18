import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { SubjectsClient } from "./subjects-client";

export default async function SubjectsPage() {
  const session = await auth();
  const schoolId = (session?.user as Record<string, unknown>)?.schoolId as string;

  const subjects = await prisma.subject.findMany({
    where: { schoolId },
    include: { _count: { select: { teachers: true } } },
    orderBy: { name: "asc" },
  });

  return <SubjectsClient subjects={subjects} />;
}
