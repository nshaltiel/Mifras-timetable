import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { SchoolAdminClient } from "./school-admin-client";

export default async function SchoolAdminPage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const { schoolId } = await params;
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    include: {
      users: { orderBy: { createdAt: "asc" } },
      _count: { select: { teachers: true, classes: true, rooms: true, subjects: true } },
    },
  });
  if (!school) notFound();

  return <SchoolAdminClient school={school} />;
}
