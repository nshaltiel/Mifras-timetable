"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function registerSchool(data: {
  schoolName: string;
  principalName: string;
  principalPhone: string;
  users: { name: string; email: string; password: string; role: string }[];
}) {
  if (!data.schoolName?.trim()) throw new Error("שם בית הספר הוא שדה חובה");
  if (!data.principalName?.trim()) throw new Error("שם המנהל הוא שדה חובה");
  if (!data.users?.length) throw new Error("יש להגדיר לפחות משתמש אחד");

  const firstUser = data.users[0];
  if (!firstUser.email || !firstUser.password)
    throw new Error("מייל וסיסמה הם שדות חובה");

  // Check email not taken
  const existing = await prisma.user.findUnique({
    where: { email: firstUser.email },
  });
  if (existing) throw new Error("כתובת המייל כבר קיימת במערכת");

  const school = await prisma.school.create({
    data: {
      name: data.schoolName.trim(),
      principalName: data.principalName.trim(),
      principalPhone: data.principalPhone?.trim() || null,
    },
  });

  for (const user of data.users) {
    if (!user.email || !user.password || !user.name) continue;
    const hashed = await bcrypt.hash(user.password, 10);
    await prisma.user.create({
      data: {
        name: user.name.trim(),
        email: user.email.trim().toLowerCase(),
        password: hashed,
        role: user.role || "ADMIN",
        schoolId: school.id,
      },
    });
  }

  return { schoolId: school.id };
}
