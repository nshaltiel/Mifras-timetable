export type PeriodTime = { start: string; end: string };

export function parsePeriodTimes(raw: string | null | undefined): PeriodTime[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((p) => p?.start && p?.end)) {
      return parsed as PeriodTime[];
    }
  } catch {}
  return [];
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function datesInRange(startAt: Date, endAt: Date): Date[] {
  const result: Date[] = [];
  const cur = new Date(startAt.getFullYear(), startAt.getMonth(), startAt.getDate());
  const end = new Date(endAt.getFullYear(), endAt.getMonth(), endAt.getDate());
  while (cur <= end) {
    result.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

/**
 * Given an event's start/end datetime and the school's period times, return
 * a map from ISO date string → array of period indices (0-based) that fall
 * within the event on that date. Weekdays outside Sun-Thu (0-4) are skipped
 * if `skipWeekends` is true (Fri=5, Sat=6 excluded).
 */
export function computeEventPeriodsByDate(
  startAt: Date,
  endAt: Date,
  periodTimes: PeriodTime[],
  periodCount: number,
  opts: { skipWeekends?: boolean } = {},
): Record<string, number[]> {
  const { skipWeekends = true } = opts;
  const result: Record<string, number[]> = {};
  const dates = datesInRange(startAt, endAt);

  const effectiveCount = periodTimes.length > 0 ? periodTimes.length : periodCount;

  for (const date of dates) {
    const dow = date.getDay();
    if (skipWeekends && (dow === 5 || dow === 6)) continue;

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const windowStart = startAt > dayStart ? startAt : dayStart;
    const windowEnd = endAt < dayEnd ? endAt : dayEnd;

    const winStartMin = windowStart.getHours() * 60 + windowStart.getMinutes();
    const winEndMin = windowEnd.getHours() * 60 + windowEnd.getMinutes();

    const periods: number[] = [];
    if (periodTimes.length > 0) {
      for (let i = 0; i < periodTimes.length; i++) {
        const pStart = toMinutes(periodTimes[i].start);
        const pEnd = toMinutes(periodTimes[i].end);
        if (pStart < winEndMin && pEnd > winStartMin) periods.push(i);
      }
    } else {
      for (let i = 0; i < effectiveCount; i++) periods.push(i);
    }

    if (periods.length > 0) result[toIsoDate(date)] = periods;
  }

  return result;
}

export function mergePeriods(a: number[], b: number[]): number[] {
  const set = new Set<number>([...a, ...b]);
  return [...set].sort((x, y) => x - y);
}

export function eventStatus(
  startAt: Date,
  endAt: Date,
  now: Date = new Date(),
): "upcoming" | "active" | "past" {
  if (now < startAt) return "upcoming";
  if (now > endAt) return "past";
  return "active";
}

export const EVENT_TYPE_HE: Record<string, string> = {
  TRIP: "טיול",
  CEREMONY: "טקס",
  SPORTS_DAY: "יום ספורט",
  ASSEMBLY: "אסיפה",
  OTHER: "אחר",
};
