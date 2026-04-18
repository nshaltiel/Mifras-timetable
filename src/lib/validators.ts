import { z } from "zod";

export const teacherSchema = z.object({
  name: z.string().min(2, "שם חייב להכיל לפחות 2 תווים"),
  email: z.string().email("כתובת אימייל לא תקינה").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  gender: z.enum(["MALE", "FEMALE", "UNSPECIFIED"]).default("UNSPECIFIED"),
  maxHoursPerWeek: z.coerce.number().int().positive().optional().or(z.literal("")),
  considerationPercent: z.coerce.number().int().min(0).max(100).default(0),
  personalSituation: z.string().optional().or(z.literal("")),
  subjectIds: z.array(z.string()).optional(),
});

export const classSchema = z.object({
  name: z.string().min(1, "שם כיתה נדרש"),
  grade: z.coerce.number().int().min(1).max(12),
  studentCount: z.coerce.number().int().min(0).default(0),
  homeroomTeacherId: z.string().optional().or(z.literal("")),
});

export const roomSchema = z.object({
  name: z.string().min(1, "שם חדר נדרש"),
  capacity: z.coerce.number().int().min(0).default(40),
  type: z.string().default("REGULAR"),
  maxConcurrentClasses: z.coerce.number().int().min(1).default(1),
});

export const subjectSchema = z.object({
  name: z.string().min(1, "שם מקצוע נדרש"),
  category: z.string().optional().or(z.literal("")),
  color: z.string().optional().or(z.literal("")),
});

export type TeacherInput = z.infer<typeof teacherSchema>;
export type ClassInput = z.infer<typeof classSchema>;
export type RoomInput = z.infer<typeof roomSchema>;
export type SubjectInput = z.infer<typeof subjectSchema>;
