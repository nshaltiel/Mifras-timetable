export const DAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי"] as const;

export const DAYS_SHORT_HE = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'"] as const;

export const PERIOD_LABELS = Array.from({ length: 10 }, (_, i) => `שיעור ${i + 1}`);

export const ABSENCE_REASON_HE: Record<string, string> = {
  SICK: "מחלה",
  PERSONAL: "אישי",
  PROFESSIONAL_DEVELOPMENT: "השתלמות",
  MILITARY_RESERVE: "מילואים",
  MATERNITY: "חל\"ד",
  SCHOOL_EVENT: "אירוע בי\"ס",
  OTHER: "אחר",
};

export const ABSENCE_STATUS_HE: Record<string, string> = {
  UNRESOLVED: "לא תוקן",
  PARTIALLY_RESOLVED: "תוקן חלקית",
  RESOLVED: "תוקן",
};

export const SOLUTION_TYPE_HE: Record<string, string> = {
  SUBSTITUTE_TEACHER: "מורה ממלא מקום",
  CANCEL_LESSON: "ביטול שיעור",
  MERGE_CLASSES: "איחוד כיתות",
  TIME_SWAP: "החלפת שעות",
  DISTRIBUTE_TO_HOMEROOM: "פיזור לכיתות אם",
  DISSOLVE_STUDY_GROUP: "פירוק הקבצה",
  SELF_STUDY: "שיעור עצמי",
};

export const ROOM_TYPE_HE: Record<string, string> = {
  REGULAR: "כיתה רגילה",
  LAB: "מעבדה",
  COMPUTER: "מחשבים",
  GYM: "חדר ספורט",
  AUDITORIUM: "אולם",
};

export const SUBJECT_CATEGORY_HE: Record<string, string> = {
  core: "ליבה",
  elective: "בחירה",
  enrichment: "העשרה",
};

export const GRADE_HE: Record<number, string> = {
  1: "א'",
  2: "ב'",
  3: "ג'",
  4: "ד'",
  5: "ה'",
  6: "ו'",
  7: "ז'",
  8: "ח'",
  9: "ט'",
  10: "י'",
  11: "י\"א",
  12: "י\"ב",
};
