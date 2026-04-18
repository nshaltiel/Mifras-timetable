"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { Check, Undo2, MessageCircle, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { applySubstitution, removeSubstitution } from "@/lib/substitution-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { PERIOD_LABELS } from "@/lib/constants";
import type { Suggestion, SlotInfo, SolutionType } from "@/engine/substitution-solver";

// ─── Labels ───────────────────────────────────────────────────────────────────

const SOLUTION_TYPE_LABELS: Record<SolutionType, string> = {
  SUBSTITUTE_TEACHER: "מורה מחליף",
  CANCEL_LESSON: "ביטול שיעור",
  MERGE_CLASSES: "מיזוג כיתות",
  TIME_SWAP: "החלפת שיעורים",
  DISSOLVE_STUDY_GROUP: "פירוק קבוצה",
  DISTRIBUTE_TO_HOMEROOM: "פיקוח מחנך",
  SELF_STUDY: "שיעור עצמי",
};

const SCORE_TONE = (score: number): "success" | "gold" | "ghost" => {
  if (score >= 90) return "success";
  if (score >= 70) return "gold";
  return "ghost";
};

// ─── Interfaces ───────────────────────────────────────────────────────────────

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

// ─── WhatsApp helpers ─────────────────────────────────────────────────────────

function buildWhatsAppUrl(phone: string, message: string): string {
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
  return ["היי,", `המורה ${absentTeacherName} יעדר היום.`,
    `האם ${canVerb} להחליף אותו/ה ב${periodLabel}${timeInfo ? " " + timeInfo : ""}${classInfo ? " " + classInfo : ""}${roomInfo ? " " + roomInfo : ""}?`
  ].join(" ");
}

// ─── Suggestion Card ──────────────────────────────────────────────────────────

function SuggestionRow({
  suggestion, idx, isFirst, absentTeacherName, period, periodTimes, slot, teacherDetails, isPending, onApply,
}: {
  suggestion: Suggestion;
  idx: number;
  isFirst: boolean;
  absentTeacherName: string;
  period: number;
  periodTimes: { start: string; end: string }[];
  slot: SlotInfo | null;
  teacherDetails: Record<string, { phone: string | null; gender: string }>;
  isPending: boolean;
  onApply: (s: Suggestion) => void;
}) {
  const subTeacherId = suggestion.type === "SUBSTITUTE_TEACHER"
    ? (suggestion.details.substituteTeacherId as string | undefined)
    : undefined;
  const subTeacherDetails = subTeacherId ? teacherDetails[subTeacherId] : undefined;
  const whatsappHref = subTeacherDetails?.phone
    ? buildWhatsAppUrl(subTeacherDetails.phone, buildWhatsAppMessage({ gender: subTeacherDetails.gender, absentTeacherName, period, periodTimes, slot }))
    : null;

  const scoreTone = SCORE_TONE(suggestion.score);
  const scoreBg = scoreTone === "success"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : scoreTone === "gold"
    ? "bg-mifras-gold-50 text-amber-700 border-amber-200"
    : "bg-mifras-ink-50 text-mifras-ink-500 border-mifras-ink-200";

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
      isFirst
        ? "border-mifras-orange-200 bg-mifras-orange-50/40"
        : "border-mifras-ink-100 hover:bg-mifras-ink-50"
    }`}>
      {/* Score badge */}
      <div className={`min-w-[36px] h-9 rounded-lg border flex flex-col items-center justify-center text-center ${scoreBg}`}>
        <span className="text-[11px] font-bold leading-none">{suggestion.score}</span>
        <span className="text-[9px] opacity-60">נק׳</span>
      </div>

      {/* Description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isFirst && <Sparkles className="size-3 text-mifras-orange-500 shrink-0" />}
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-mifras-navy-50 text-mifras-navy-700 font-medium">
            {SOLUTION_TYPE_LABELS[suggestion.type]}
          </span>
        </div>
        <p className="text-[13px] mt-0.5 text-mifras-ink-800 truncate">{suggestion.description}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {whatsappHref && (
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" className="size-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" title="שלח WhatsApp">
              <MessageCircle className="size-3.5" />
            </Button>
          </a>
        )}
        <Button size="sm"
          variant={isFirst ? "default" : "outline"}
          className={isFirst ? "" : "text-[12.5px] h-7 px-3"}
          onClick={() => onApply(suggestion)}
          disabled={isPending}
        >
          החל
        </Button>
      </div>
    </div>
  );
}

// ─── Period Card ──────────────────────────────────────────────────────────────

function PeriodCard({
  period, slot, suggestions, existingSubstitution,
  absenceId, absentTeacherName, teacherDetails, periodTimes, isPending, onApply, onRemove,
}: {
  period: number;
  slot: SlotInfo | null;
  suggestions: Suggestion[];
  existingSubstitution: ExistingSubstitution | null;
  absenceId: string;
  absentTeacherName: string;
  teacherDetails: Record<string, { phone: string | null; gender: string }>;
  periodTimes: { start: string; end: string }[];
  isPending: boolean;
  onApply: (period: number, s: Suggestion) => void;
  onRemove: (period: number) => void;
}) {
  const [expanded, setExpanded] = useState(!existingSubstitution);
  const isResolved = !!existingSubstitution;

  const resolvedSubTeacherId = existingSubstitution?.substituteTeacherId ?? null;
  const resolvedSubDetails = resolvedSubTeacherId ? teacherDetails[resolvedSubTeacherId] : null;
  const resolvedWhatsapp = resolvedSubDetails?.phone
    ? buildWhatsAppUrl(resolvedSubDetails.phone, buildWhatsAppMessage({ gender: resolvedSubDetails.gender, absentTeacherName, period, periodTimes, slot }))
    : null;

  const timeLabel = periodTimes[period]?.start && periodTimes[period]?.end
    ? `${periodTimes[period].start}–${periodTimes[period].end}`
    : null;

  return (
    <div className={`rounded-[14px] border bg-white overflow-hidden ${
      isResolved ? "border-emerald-200" : "border-mifras-ink-100"
    }`}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-start hover:bg-mifras-ink-50/50 transition-colors"
      >
        {/* Status circle */}
        {isResolved ? (
          <span className="size-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
            <Check className="size-3.5 text-white" />
          </span>
        ) : (
          <span className="size-6 rounded-full border-2 border-mifras-orange-400 flex items-center justify-center shrink-0">
            <span className="size-1.5 rounded-full bg-mifras-orange-500" />
          </span>
        )}

        {/* Period label */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[14px] text-mifras-ink-900">
              {PERIOD_LABELS[period] || `שיעור ${period + 1}`}
            </span>
            {timeLabel && (
              <span className="text-[12px] text-mifras-ink-400">{timeLabel}</span>
            )}
            {slot && (
              <span className="text-[12.5px] text-mifras-ink-500">
                · {slot.subjectName} · {slot.className}
              </span>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {isResolved && (
            <>
              <StatusPill tone="done">
                {SOLUTION_TYPE_LABELS[existingSubstitution.solutionType as SolutionType] || existingSubstitution.solutionType}
              </StatusPill>
              {resolvedWhatsapp && (
                <a href={resolvedWhatsapp} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="size-7 text-emerald-600 hover:bg-emerald-50">
                    <MessageCircle className="size-3.5" />
                  </Button>
                </a>
              )}
              <Button
                variant="ghost" size="icon" className="size-7"
                onClick={(e) => { e.stopPropagation(); onRemove(period); }}
                disabled={isPending}
              >
                <Undo2 className="size-3.5" />
              </Button>
            </>
          )}
          {!isResolved && (
            <StatusPill tone="open">טרם טופל</StatusPill>
          )}
          {expanded ? (
            <ChevronUp className="size-4 text-mifras-ink-400 shrink-0" />
          ) : (
            <ChevronDown className="size-4 text-mifras-ink-400 shrink-0" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-mifras-ink-100">
          {!slot ? (
            <p className="text-[13px] text-mifras-ink-400 pt-3">אין שיעור מוגדר בשעה זו.</p>
          ) : suggestions.length === 0 ? (
            <p className="text-[13px] text-mifras-ink-400 text-center py-4">לא נמצאו הצעות אוטומטיות לשיעור זה.</p>
          ) : (
            <>
              <p className="text-[12px] text-mifras-ink-400 pt-3 flex items-center gap-1">
                <Sparkles className="size-3 text-mifras-orange-400" />
                הצעות מומלצות ({suggestions.length})
              </p>
              {suggestions.map((s, idx) => (
                <SuggestionRow
                  key={idx}
                  suggestion={s}
                  idx={idx}
                  isFirst={idx === 0}
                  absentTeacherName={absentTeacherName}
                  period={period}
                  periodTimes={periodTimes}
                  slot={slot}
                  teacherDetails={teacherDetails}
                  isPending={isPending}
                  onApply={(sug) => onApply(period, sug)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function SubstitutionWizard({ absenceId, data }: SubstitutionWizardProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const totalPeriods = data.periodSuggestions.length;
  const resolvedCount = data.periodSuggestions.filter((p) => p.existingSubstitution).length;

  function handleApply(period: number, suggestion: Suggestion) {
    startTransition(async () => {
      try {
        await applySubstitution({
          absenceId,
          period,
          solutionType: suggestion.type,
          substituteTeacherId: suggestion.details.substituteTeacherId as string | undefined,
          mergedWithClassId: suggestion.details.mergeIntoClassId as string | undefined,
          swapDetails: suggestion.type === "TIME_SWAP" ? JSON.stringify(suggestion.details) : undefined,
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

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="rounded-[12px] border border-mifras-ink-100 bg-white p-4 flex items-center gap-4">
        <div className="flex-1">
          <div className="flex justify-between text-[12.5px] text-mifras-ink-500 mb-1.5">
            <span>טיפול בשיעורים</span>
            <span className="font-semibold">{resolvedCount}/{totalPeriods}</span>
          </div>
          <div className="h-2 rounded-full bg-mifras-ink-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${totalPeriods > 0 ? (resolvedCount / totalPeriods) * 100 : 0}%` }}
            />
          </div>
        </div>
        {resolvedCount === totalPeriods && totalPeriods > 0 && (
          <span className="text-[12.5px] font-semibold text-emerald-600 flex items-center gap-1">
            <Check className="size-3.5" />
            הכל טופל!
          </span>
        )}
      </div>

      {/* Period cards */}
      {data.periodSuggestions.map(({ period, slot, suggestions, existingSubstitution }) => (
        <PeriodCard
          key={period}
          period={period}
          slot={slot}
          suggestions={suggestions}
          existingSubstitution={existingSubstitution}
          absenceId={absenceId}
          absentTeacherName={data.absence.teacher.name}
          teacherDetails={data.teacherDetails}
          periodTimes={data.periodTimes}
          isPending={isPending}
          onApply={handleApply}
          onRemove={handleRemove}
        />
      ))}
    </div>
  );
}
