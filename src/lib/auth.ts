import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "אימייל", type: "email" },
        password: { label: "סיסמה", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Check SuperAdmin first
        const superAdmin = await prisma.superAdmin.findUnique({
          where: { email: credentials.email as string },
        });
        if (superAdmin) {
          const isValid = await bcrypt.compare(credentials.password as string, superAdmin.password);
          if (!isValid) return null;
          return {
            id: superAdmin.id,
            email: superAdmin.email,
            name: superAdmin.name,
            role: "SUPER_ADMIN",
            schoolId: null,
            schoolName: null,
            isSuperAdmin: true,
          };
        }

        // Check regular User
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { school: true },
        });
        if (!user) return null;
        const isValid = await bcrypt.compare(credentials.password as string, user.password);
        if (!isValid) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          schoolId: user.schoolId,
          schoolName: user.school.name,
          isSuperAdmin: false,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as Record<string, unknown>).role;
        token.schoolId = (user as Record<string, unknown>).schoolId;
        token.schoolName = (user as Record<string, unknown>).schoolName;
        token.isSuperAdmin = (user as Record<string, unknown>).isSuperAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        (session.user as unknown as Record<string, unknown>).role = token.role;
        (session.user as unknown as Record<string, unknown>).schoolId = token.schoolId;
        (session.user as unknown as Record<string, unknown>).schoolName = token.schoolName;
        (session.user as unknown as Record<string, unknown>).isSuperAdmin = token.isSuperAdmin;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
