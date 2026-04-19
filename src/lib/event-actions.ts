"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { auth } from "./auth";
import {
  computeEventPeriodsByDate,
  mergePeriods,
  parsePeriodTimes,
} from "./event-helpers";

async function getSchoolId() {
  const session = await auth();
  const schoolId = (session?.user as Record<string, unknown>)?.schoolId as string;
  if (!schoolId) throw new Error("לא מחובר");
  return schoolId;
}

type EventInput = {
  name: string;
  description: string | null;
  eventType: string | null;
  startAt: Date;
  endAt: Date;
  classIds: string[];
  teacherIds: string[];
};

function parseEventForm(data: FormData): EventInput {
  const name = String(data.get("name") || "").trim();
  if (!name) throw new Error("שם האירוע חובה");
  const startAtRaw = String(data.get("startAt") || "");
  const endAtRaw = String(data.get("endAt") || "");
  if (!startAtRaw || !endAtRaw) throw new Error("תאריך התחלה וסיום חובה");
  const startAt = new Date(startAtRaw);
  const endAt = new Date(endAtRaw);
  if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) throw new Error("תאריכים לא תקינים");
  if (endAt < startAt) throw new Error("תאריך סיום חייב להיות אחרי תאריך התחלה");

  return {
    name,
    description: (data.get("description") as string) || null,
    eventType: (data.get("eventType") as string) || null,
    startAt,
    endAt,
    classIds: data.getAll("classIds").map(String).filter(Boolean),
    teacherIds: data.getAll("teacherIds").map(String).filter(Boolean),
  };
}

async function regenerateEventAbsences(eventId: string, schoolId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { participatingTeachers: true },
  });
  if (!event || event.schoolId !== schoolId) return;

  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  const periodTimes = parsePeriodTimes(school?.periodTimes);
  const periodCount = school?.periodCount ?? 10;

  const periodsByDate = computeEventPeriodsByDate(
    event.startAt,
    event.endAt,
    periodTimes,
    periodCount,
  );

  const teacherIds = event.participatingTeachers.map((t) => t.teacherId);

  // 1. Delete absences linked to this event that are no longer relevant
  //    (teacher removed, or date no longer covered).
  const existing = await prisma.absence.findMany({ where: { eventId } });
  const keepDates = new Set(Object.keys(periodsByDate));
  const toDelete = existing.filter(
    (a) => !teacherIds.includes(a.teacherId) || !keepDates.has(a.date),
  );
  if (toDelete.length > 0) {
    // Unlink event reference first (cascade behavior is SetNull, but we want to
    // fully delete absences created purely by this event)
    for (const abs of toDelete) {
      const hasSubs = await prisma.substitution.count({ where: { absenceId: abs.id } });
      if (hasSubs === 0) {
        await prisma.absence.delete({ where: { id: abs.id } });
      } else {
        await prisma.absence.update({
          where: { id: abs.id },
          data: { eventId: null },
        });
      }
    }
  }

  // 2. Upsert absences for each (teacher, date) pair in the event window
  for (const teacherId of teacherIds) {
    for (const [date, periods] of Object.entries(periodsByDate)) {
      const prev = await prisma.absence.findUnique({
        where: { teacherId_date: { teacherId, date } },
      });
      const periodsJson = JSON.stringify(periods);
      if (!prev) {
        await prisma.absence.create({
          data: {
            teacherId,
            date,
            periods: periodsJson,
            reason: event.name,
            eventId: event.id,
          },
        });
      } else {
        // Merge periods if existing absence is ours or manual; keep existing reason if manual
        let existingPeriods: number[] = [];
        try { existingPeriods = JSON.parse(prev.periods); } catch {}
        const merged = mergePeriods(existingPeriods, periods);
        await prisma.absence.update({
          where: { id: prev.id },
          data: {
            periods: JSON.stringify(merged),
            eventId: prev.eventId ?? event.id,
            reason: prev.eventId || prev.reason === event.name ? event.name : `${prev.reason} + ${event.name}`,
          },
        });
      }
    }
  }
}

export async function createEvent(data: FormData) {
  const schoolId = await getSchoolId();
  const input = parseEventForm(data);

  const event = await prisma.event.create({
    data: {
      schoolId,
      name: input.name,
      description: input.description,
      eventType: input.eventType,
      startAt: input.startAt,
      endAt: input.endAt,
      participatingClasses: {
        create: input.classIds.map((classId) => ({ classId })),
      },
      participatingTeachers: {
        create: input.teacherIds.map((teacherId) => ({ teacherId })),
      },
    },
  });

  await regenerateEventAbsences(event.id, schoolId);

  revalidatePath("/settings");
  revalidatePath("/timetable");
  revalidatePath("/substitutions");
  return { id: event.id };
}

export async function updateEvent(id: string, data: FormData) {
  const schoolId = await getSchoolId();
  const input = parseEventForm(data);

  const existing = await prisma.event.findFirst({ where: { id, schoolId } });
  if (!existing) throw new Error("אירוע לא נמצא");

  await prisma.eventClass.deleteMany({ where: { eventId: id } });
  await prisma.eventTeacher.deleteMany({ where: { eventId: id } });

  await prisma.event.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      eventType: input.eventType,
      startAt: input.startAt,
      endAt: input.endAt,
      participatingClasses: {
        create: input.classIds.map((classId) => ({ classId })),
      },
      participatingTeachers: {
        create: input.teacherIds.map((teacherId) => ({ teacherId })),
      },
    },
  });

  await regenerateEventAbsences(id, schoolId);

  revalidatePath("/settings");
  revalidatePath("/timetable");
  revalidatePath("/substitutions");
}

export async function deleteEvent(id: string) {
  const schoolId = await getSchoolId();
  const existing = await prisma.event.findFirst({ where: { id, schoolId } });
  if (!existing) throw new Error("אירוע לא נמצא");

  // Remove absences that were only created by this event (no substitutions yet).
  const absences = await prisma.absence.findMany({ where: { eventId: id } });
  for (const abs of absences) {
    const subs = await prisma.substitution.count({ where: { absenceId: abs.id } });
    if (subs === 0) {
      await prisma.absence.delete({ where: { id: abs.id } });
    }
  }

  await prisma.event.delete({ where: { id } });

  revalidatePath("/settings");
  revalidatePath("/timetable");
  revalidatePath("/substitutions");
}
