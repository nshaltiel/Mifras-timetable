"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Undo2, Zap, MessageCircle } from "lucide-react";
import { applySubstitution, removeSubstitution } from "@/lib/substitution-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { PERIOD_LABELS } from "@/lib/constants";
import type { Suggestion, SlotInfo, SolutionType } from "@/engine/substitution-solver";

const SOLUTION_TYPE_LABELS: Record<SolutionType, string> = {
  SUBSTITUTE_TEACHER: "מורה מחליף",
  CANCEL_LESSON: "ביטול שיעור",
  MERGE_CLASSES: "מיזוג כיתות",
  TIME_SWAP: "החלפת שיעורים",
  DISSOLVE_STUDY_GROUP: "פירוק קבוצה",
  DISTRIBUTE_TO_HOMEROOM: "שיעור עצמי בפיקוח מחנך",
  SELF_STUDY: "שיעור עצמי",
};

const SOLUTION_TYPE_COLORS: Record<SolutionType, string> = {
  SUBSTITUTE_TEACHER: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  MERGE_CLASSES: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  TIME_SWAP: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  DISSOLVE_STUDY_GROUP: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  DISTRIBUTE_TO_HOMEROOM: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  SELF_STUDY: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  CANCEL_LESSON: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

interface ExistingSubstitution {
  id: string;
  period: number;
  solutionType: string;
  substituteTeacherId: string | null;
  notes: string | null;
}

interface PeriodData {
  period: number;
  slot: SlotInfo | null;
  suggestions: Suggestion[];
  existingSubstitution: ExistingSubstitution | null;
}

interface SubstitutionWizardProps {
  absenceId: string;
  data: {
    absence: { id: string; teacher: { name: string }; date: string; status: string };
    periodSuggestions: PeriodData[];
    dayOfWeek: number;
    teacherDetails: Record<string, { phone: string | null; gender: string }>;
    periodTimes: { start: string; end: string }[];
  };
}

function buildWhatsAppUrl(phone: string, message: string): string {
  // Normalize phone: remove non-digits, handle Israeli 05x -> +9725x
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("0") ? "972" + digits.slice(1) : digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

function buildWhatsAppMessage({
  gender,
  absentTeacherName,
  period,
  periodTimes,
  slot,
}: {
  gender: string;
  absentTeacherName: string;
  period: number;
  periodTimes: { start: string; end: string }[];
  slot: SlotInfo | null;
}): string {
  const canVerb = gender === "FEMALE" ? "תוכלי" : gender === "MALE" ? "תוכל" : "תוכל.י";
  const periodLabel = `שיעור ${period + 1}`;
  const timeInfo = periodTimes[period]?.start && periodTimes[period]?.end
    ? `בין השעות ${periodTimes[period].start}–${periodTimes[period].end}`
    : "";
  const classInfo = slot ? `עבור כיתה ${slot.className}` : "";
  const roomInfo = slot?.roomName ? `בחדר ${slot.roomName}` : "";

  const parts = ["היי,", `המורה ${absentTeacherName} יעדר היום.`, `האם ${canVerb} להחליף אותו/ה ב${periodLabel}${timeInfo ? " " + timeInfo : ""}${classInfo ? " " + classInfo : ""}${roomInfo ? " " + roomInfo : ""}?`];
  return parts.join(" ");
}

export function SubstitutionWizard({ absenceId, data }: SubstitutionWizardProps) {
  const [isPending, startTransition] = useTransition();
  const [expandedPeriod, setExpandedPeriod] = useState<number | null>(
    data.periodSuggestions.find((p) => !p.existingSubstitution)?.period ?? null
  );
  const router = useRouter();

  function handleApply(period: number, suggestion: Suggestion) {
    startTransition(async () => {
      try {
        await applySubstitution({
          absenceId,
          period,
          solutionType: suggestion.type,
          substituteTeacherId: suggestion.details.substituteTeacherId as string | undefined,
          mergedWithClassId: suggestion.details.mergeIntoClassId as string | undefined,
          swapDetails:
            suggestion.type === "TIME_SWAP" ? JSON.stringify(suggestion.details) : undefined,
        });
        toast.success("הפתרון הוחל בהצלחה");
        router.refresh();
      } catch {
        toast.error("שגיאה בהחלת הפתרון");
      }
    });
  }

  function handleRemove(period: number) {
    startTransition(async () => {
      try {
        await removeSubstitution(absenceId, period);
        toast.success("הפתרון בוטל");
        router.refresh();
      } catch {
        toast.error("שגיאה");
      }
    });
  }

  const totalPeriods = data.periodSuggestions.length;
  const resolvedCount = data.periodSuggestions.filter((p) => p.existingSubstitution).length;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${totalPeriods > 0 ? (resolvedCount / totalPeriods) * 100 : 0}%` }}
          />
        </div>
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {resolvedCount}/{totalPeriods} שיעורים טופלו
        </span>
      </div>

      {/* Period cards */}
      {data.periodSuggestions.map(({ period, slot, suggestions, existingSubstitution }) => {
        const isResolved = !!existingSubstitution;
        const isExpanded = expandedPeriod === period;

        const resolvedSubTeacherId = existingSubstitution?.substituteTeacherId ?? null;
        const resolvedSubTeacherDetails = resolvedSubTeacherId ? data.teacherDetails[resolvedSubTeacherId] : null;
        const resolvedWhatsappHref = resolvedSubTeacherDetails?.phone
          ? buildWhatsAppUrl(resolvedSubTeacherDetails.phone, buildWhatsAppMessage({ gender: resolvedSubTeacherDetails.gender, absentTeacherName: data.absence.teacher.name, period, periodTimes: data.periodTimes, slot }))
          : null;

        return (
          <Card
            key={period}
            className={isResolved ? "border-green-200 dark:border-green-800" : ""}
          >
            <CardHeader className="pb-2">
              <CardTitle
                className="text-base flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedPeriod(isExpanded ? null : period)}
              >
                <div className="flex items-center gap-2">
                  {isResolved ? (
                    <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </span>
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-destructive/20 border border-destructive/30 flex items-center justify-center">
                      <span className="text-destructive text-xs font-bold">!</span>
                    </span>
                  )}
                  <span>שיעור {period + 1} — {PERIOD_LABELS[period] || ""}</span>
                  {slot && (
                    <span className="text-sm font-normal text-muted-foreground">
                      {slot.subjectName} · {slot.className}
                    </span>
                  )}
                </div>
                {isResolved ? (
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      SOLUTION_TYPE_COLORS[existingSubstitution.solutionType as SolutionType] || ""
                    }`}>
                      {SOLUTION_TYPE_LABELS[existingSubstitution.solutionType as SolutionType] || existingSubstitution.solutionType}
                    </span>
                    {resolvedWhatsappHref && (
                      <a href={resolvedWhatsappHref} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50" title="שלח הודעת וואטסאפ">
                          <MessageCircle className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); handleRemove(period); }}
                      disabled={isPending}
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Badge variant="destructive" className="text-xs">לא תוקן</Badge>
                )}
              </CardTitle>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0">
                {!slot ? (
                  <p className="text-sm text-muted-foreground py-2">
                    אין שיעור מוגדר בשעה זו עבור המורה הנעדר.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground pb-1">
                      <Zap className="h-3.5 w-3.5 text-primary" />
                      <span>הצעות ({suggestions.length}):</span>
                    </div>
                    {suggestions.map((suggestion, idx) => {
                      const subTeacherId = suggestion.type === "SUBSTITUTE_TEACHER"
                        ? (suggestion.details.substituteTeacherId as string | undefined)
                        : undefined;
                      const subTeacherDetails = subTeacherId ? data.teacherDetails[subTeacherId] : undefined;
                      const whatsappHref = subTeacherDetails?.phone
                        ? buildWhatsAppUrl(subTeacherDetails.phone, buildWhatsAppMessage({ gender: subTeacherDetails.gender, absentTeacherName: data.absence.teacher.name, period, periodTimes: data.periodTimes, slot }))
                        : null;
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-md border border-border hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <div className="flex flex-col items-center min-w-[2.5rem]">
                              <span className="text-xs font-bold text-primary">{suggestion.score}</span>
                              <span className="text-[10px] text-muted-foreground">ניקוד</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${SOLUTION_TYPE_COLORS[suggestion.type] || ""}`}>
                                  {SOLUTION_TYPE_LABELS[suggestion.type]}
                                </span>
                              </div>
                              <p className="text-sm mt-0.5 truncate">{suggestion.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {whatsappHref && (
                              <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" title="שלח הודעת וואטסאפ">
                                  <MessageCircle className="h-4 w-4" />
                                </Button>
                              </a>
                            )}
                            <Button
                              size="sm"
                              variant={idx === 0 ? "default" : "outline"}
                              onClick={() => handleApply(period, suggestion)}
                              disabled={isPending}
                            >
                              החל
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    {suggestions.length === 0 && (
                      <p className="text-sm text-muted-foreground py-2 text-center">
                        לא נמצאו הצעות אוטומטיות לשיעור זה.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
