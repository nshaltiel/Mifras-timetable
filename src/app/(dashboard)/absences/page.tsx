import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadAbsences } from "@/lib/absence-actions";
import { AbsencesClient } from "./absences-client";

export default async function AbsencesPage() {
  const session = await auth();
  const schoolId = (session?.user as Record<string, unknown>)?.schoolId as string;

  const [absences, teachers] = await Promise.all([
    loadAbsences(),
    prisma.teacher.findMany({
      where: { schoolId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return <AbsencesClient absences={absences} teachers={teachers} />;
}
