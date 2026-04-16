"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

async function getSchoolId() {
  const session = await auth();
  const schoolId = (session?.user as Record<string, unknown>)?.schoolId as string;
  if (!schoolId) throw new Error("Unauthorized");
  return schoolId;
}

export async function addSchoolUser(data: {
  name: string;
  email: string;
  password: string;
}) {
  const schoolId = await getSchoolId();
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new Error("כתובת המייל כבר קיימת");
  const hashed = await bcrypt.hash(data.password, 10);
  await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: hashed,
      role: "ADMIN",
      schoolId,
    },
  });
  revalidatePath("/settings");
}

export async function removeSchoolUser(userId: string) {
  const schoolId = await getSchoolId();
  const count = await prisma.user.count({ where: { schoolId } });
  if (count <= 1) throw new Error("לא ניתן למחוק את המשתמש האחרון");
  await prisma.user.delete({ where: { id: userId, schoolId } });
  revalidatePath("/settings");
}

export async function updateSchoolName(name: string) {
  const schoolId = await getSchoolId();
  if (!name?.trim()) throw new Error("שם בית הספר לא יכול להיות ריק");
  await prisma.school.update({ where: { id: schoolId }, data: { name: name.trim() } });
  revalidatePath("/settings");
}

export async function resetUserPasswordByAdmin(userId: string, newPassword: string) {
  const schoolId = await getSchoolId();
  if (!newPassword || newPassword.length < 6) throw new Error("הסיסמה קצרה מדי");
  // Verify user belongs to this school
  const user = await prisma.user.findFirst({ where: { id: userId, schoolId } });
  if (!user) throw new Error("משתמש לא נמצא");
  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
  revalidatePath("/settings");
}

export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) throw new Error("הסיסמה הנוכחית שגויה");
  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
}
