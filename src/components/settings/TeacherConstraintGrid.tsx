"use client";

import { DAYS_HE, PERIOD_LABELS } from "@/lib/constants";
import { CONSTRAINT, type ConstraintType } from "@/lib/constraint-types";

interface Props {
  dayCount: number;
  periodCount: number;
  value: Record<string, ConstraintType>;
  onChange: (next: Record<string, ConstraintType>) => void;
}

const CYCLE: (ConstraintType | "")[] = [
  "",
  CONSTRAINT.UNAVAILABLE,
  CONSTRAINT.AVOID,
  CONSTRAINT.PREFER,
];

function nextState(current: ConstraintType | undefined): ConstraintType | "" {
  const idx = CYCLE.indexOf(current ?? "");
  return CYCLE[(idx + 1) % CYCLE.length];
}

function cellClass(type: ConstraintType | undefined) {
  switch (type) {
    case CONSTRAINT.UNAVAILABLE:
      return "bg-red-500/80 hover:bg-red-600/80 text-white";
    case CONSTRAINT.AVOID:
      return "bg-orange-400/80 hover:bg-orange-500/80 text-white";
    case CONSTRAINT.PREFER:
      return "bg-green-500/80 hover:bg-green-600/80 text-white";
    default:
      return "bg-muted/40 hover:bg-muted text-transparent";
  }
}

function cellLabel(type: ConstraintType | undefined) {
  switch (type) {
    case CONSTRAINT.UNAVAILABLE:
      return "✗";
    case CONSTRAINT.AVOID:
      return "−";
    case CONSTRAINT.PREFER:
      return "✓";
    default:
      return "·";
  }
}

export function TeacherConstraintGrid({ dayCount, periodCount, value, onChange }: Props) {
  function handleClick(day: number, period: number) {
    const key = `${day}-${period}`;
    const next = nextState(value[key]);
    const updated = { ...value };
    if (next === "") {
      delete updated[key];
    } else {
      updated[key] = next;
    }
    onChange(updated);
  }

  const days = Array.from({ length: dayCount }, (_, i) => i);
  const periods = Array.from({ length: periodCount }, (_, i) => i);

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr>
              <th className="w-14 text-start p-1 text-muted-foreground font-medium">שעה</th>
              {days.map((d) => (
                <th key={d} className="text-center p-1 text-muted-foreground font-medium min-w-[40px]">
                  {DAYS_HE[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => (
              <tr key={period}>
                <td className="text-start p-1 text-muted-foreground whitespace-nowrap">
                  {PERIOD_LABELS[period]}
                </td>
                {days.map((day) => {
                  const key = `${day}-${period}`;
                  const type = value[key];
                  return (
                    <td key={day} className="p-0.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleClick(day, period)}
                        className={`w-8 h-6 rounded text-xs font-bold transition-colors ${cellClass(type)}`}
                        title={
                          type === CONSTRAINT.UNAVAILABLE
                            ? "לא זמין — לחץ לשינוי"
                            : type === CONSTRAINT.AVOID
                            ? "להימנע — לחץ לשינוי"
                            : type === CONSTRAINT.PREFER
                            ? "מועדף — לחץ לשינוי"
                            : "פנוי — לחץ לסימון"
                        }
                      >
                        {cellLabel(type)}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-3 flex-wrap text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-4 rounded bg-red-500/80" />
          לא זמין (חסימה)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-4 rounded bg-orange-400/80" />
          להימנע (העדפה)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-4 rounded bg-green-500/80" />
          מועדף (העדפה)
        </span>
        <span className="text-muted-foreground/70">לחץ על תא לשינוי</span>
      </div>
    </div>
  );
}
