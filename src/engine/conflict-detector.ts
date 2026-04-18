// Pure conflict detection engine - runs both client-side and server-side

export interface SlotData {
  id?: string;
  day: number;
  period: number;
  classId: string;
  teacherId: string;
  subjectId: string;
  roomId?: string | null;
  studyGroupId?: string | null;
}

/** Optional metadata for layer/exclusion checks. */
export interface SlotContext {
  /** Allowed room IDs for the class's layer. null = no restriction. */
  allowedRoomIds?: string[] | null;
  /** Teacher IDs excluded from teaching this class. */
  excludedTeacherIds?: string[];
}

export interface TeacherConstraintData {
  teacherId: string;
  type: string;
  day?: number | null;
  period?: number | null;
}

export type ConflictType =
  | "TEACHER_DOUBLE_BOOKED"
  | "ROOM_DOUBLE_BOOKED"
  | "CLASS_DOUBLE_BOOKED"
  | "TEACHER_CONSTRAINT_VIOLATED"
  | "ROOM_NOT_IN_LAYER"
  | "TEACHER_EXCLUDED_FROM_CLASS";

export interface Conflict {
  type: ConflictType;
  message: string;
  slotA: Partial<SlotData>;
  slotB?: Partial<SlotData>;
}

/**
 * Check if a proposed slot conflicts with existing slots.
 * Returns an array of conflicts (empty = valid).
 */
export function detectConflicts(
  proposed: SlotData,
  existingSlots: SlotData[],
  teacherConstraints: TeacherConstraintData[] = [],
  context?: SlotContext
): Conflict[] {
  const conflicts: Conflict[] = [];

  for (const existing of existingSlots) {
    // Skip same slot (for updates)
    if (existing.id && proposed.id && existing.id === proposed.id) continue;

    const sameTime = existing.day === proposed.day && existing.period === proposed.period;
    if (!sameTime) continue;

    // Teacher double-booked
    if (existing.teacherId === proposed.teacherId) {
      conflicts.push({
        type: "TEACHER_DOUBLE_BOOKED",
        message: `המורה כבר מלמד/ת בשעה זו`,
        slotA: proposed,
        slotB: existing,
      });
    }

    // Class double-booked
    if (existing.classId === proposed.classId) {
      conflicts.push({
        type: "CLASS_DOUBLE_BOOKED",
        message: `לכיתה כבר יש שיעור בשעה זו`,
        slotA: proposed,
        slotB: existing,
      });
    }

    // Room double-booked
    if (
      proposed.roomId &&
      existing.roomId &&
      existing.roomId === proposed.roomId
    ) {
      conflicts.push({
        type: "ROOM_DOUBLE_BOOKED",
        message: `החדר כבר תפוס בשעה זו`,
        slotA: proposed,
        slotB: existing,
      });
    }
  }

  // Layer room restriction check
  if (
    context?.allowedRoomIds != null &&
    context.allowedRoomIds.length > 0 &&
    proposed.roomId &&
    !context.allowedRoomIds.includes(proposed.roomId)
  ) {
    conflicts.push({
      type: "ROOM_NOT_IN_LAYER",
      message: "החדר אינו מותר לשכבה של הכיתה",
      slotA: proposed,
    });
  }

  // Teacher excluded from class check
  if (
    context?.excludedTeacherIds &&
    context.excludedTeacherIds.includes(proposed.teacherId)
  ) {
    conflicts.push({
      type: "TEACHER_EXCLUDED_FROM_CLASS",
      message: "המורה אינו/ה מורשה ללמד כיתה זו",
      slotA: proposed,
    });
  }

  // Teacher constraint check
  for (const constraint of teacherConstraints) {
    if (constraint.teacherId !== proposed.teacherId) continue;
    if (constraint.type !== "UNAVAILABLE") continue;

    const dayMatch =
      constraint.day == null || constraint.day === proposed.day;
    const periodMatch =
      constraint.period == null || constraint.period === proposed.period;

    if (dayMatch && periodMatch) {
      conflicts.push({
        type: "TEACHER_CONSTRAINT_VIOLATED",
        message: `המורה לא זמין/ה בשעה זו`,
        slotA: proposed,
      });
    }
  }

  return conflicts;
}

/** Build a key for a time slot */
export function slotKey(day: number, period: number, classId: string) {
  return `${day}-${period}-${classId}`;
}

/** Build a teacher-time key for quick lookup */
export function teacherTimeKey(day: number, period: number, teacherId: string) {
  return `${day}-${period}-${teacherId}`;
}
