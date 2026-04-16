"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

async function requireSuperAdmin() {
  const session = await auth();
  const isSuperAdmin = (session?.user as Record<string, unknown>)?.isSuperAdmin;
  if (!isSuperAdmin) throw new Error("Unauthorized");
}

export async function createSchoolWithAdmin(data: {
  schoolName: string;
  principalName: string;
  principalPhone: string;
  users: { name: string; email: string; password: string; role: string }[];
}) {
  await requireSuperAdmin();

  if (!data.schoolName || !data.principalName)
    throw new Error("שם בית הספר ושם המנהל הם שדות חובה");
  if (data.users.length === 0)
    throw new Error("יש להגדיר לפחות משתמש אחד");

  const school = await prisma.school.create({
    data: {
      name: data.schoolName,
      principalName: data.principalName,
      principalPhone: data.principalPhone || null,
    },
  });

  for (const user of data.users) {
    if (!user.email || !user.password || !user.name) continue;
    const hashed = await bcrypt.hash(user.password, 10);
    await prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
        password: hashed,
        role: user.role || "ADMIN",
        schoolId: school.id,
      },
    });
  }

  revalidatePath("/admin");
  return school;
}

export async function resetUserPassword(userId: string, newPassword: string) {
  await requireSuperAdmin();
  if (!newPassword || newPassword.length < 6)
    throw new Error("הסיסמה קצרה מדי");
  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
  revalidatePath("/admin");
}

export async function addUserToSchool(
  schoolId: string,
  user: { name: string; email: string; password: string; role: string }
) {
  await requireSuperAdmin();
  if (!user.email || !user.name || !user.password)
    throw new Error("שדות חסרים");
  const hashed = await bcrypt.hash(user.password, 10);
  await prisma.user.create({
    data: {
      name: user.name,
      email: user.email,
      password: hashed,
      role: user.role,
      schoolId,
    },
  });
  revalidatePath(`/admin/schools/${schoolId}`);
}

export async function removeUserFromSchool(userId: string, schoolId: string) {
  await requireSuperAdmin();
  const count = await prisma.user.count({ where: { schoolId } });
  if (count <= 1)
    throw new Error("לא ניתן למחוק את המשתמש האחרון של בית הספר");
  await prisma.user.delete({ where: { id: userId } });
  revalidatePath(`/admin/schools/${schoolId}`);
}

// ── Super Admin Management ──────────────────────────────────────────────────

export async function listSuperAdmins() {
  await requireSuperAdmin();
  return prisma.superAdmin.findMany({
    select: { id: true, email: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function createSuperAdmin(data: { name: string; email: string; password: string }) {
  await requireSuperAdmin();
  if (!data.name || !data.email || !data.password)
    throw new Error("כל השדות הם חובה");
  if (data.password.length < 6)
    throw new Error("הסיסמה קצרה מדי (מינימום 6 תווים)");
  const existing = await prisma.superAdmin.findUnique({ where: { email: data.email } });
  if (existing) throw new Error("כתובת המייל כבר קיימת");
  const hashed = await bcrypt.hash(data.password, 10);
  await prisma.superAdmin.create({ data: { name: data.name, email: data.email, password: hashed } });
  revalidatePath("/admin/super-admins");
}

export async function resetSuperAdminPassword(id: string, newPassword: string) {
  await requireSuperAdmin();
  if (!newPassword || newPassword.length < 6)
    throw new Error("הסיסמה קצרה מדי (מינימום 6 תווים)");
  const session = await auth();
  const currentEmail = session?.user?.email;
  const target = await prisma.superAdmin.findUnique({ where: { id } });
  if (!target) throw new Error("משתמש לא נמצא");
  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.superAdmin.update({ where: { id }, data: { password: hashed } });
  revalidatePath("/admin/super-admins");
  return { email: target.email, isSelf: target.email === currentEmail };
}

export async function deleteSuperAdmin(id: string) {
  await requireSuperAdmin();
  const session = await auth();
  const currentEmail = session?.user?.email;
  const target = await prisma.superAdmin.findUnique({ where: { id } });
  if (!target) throw new Error("משתמש לא נמצא");
  if (target.email === currentEmail) throw new Error("לא ניתן למחוק את המשתמש שלך");
  const count = await prisma.superAdmin.count();
  if (count <= 1) throw new Error("חייב להישאר לפחות מנהל מערכת אחד");
  await prisma.superAdmin.delete({ where: { id } });
  revalidatePath("/admin/super-admins");
}
