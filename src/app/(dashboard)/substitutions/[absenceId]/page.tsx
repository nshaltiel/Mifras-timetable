import { getSubstitutionPageData } from "@/lib/substitution-actions";
import { SubstitutionWizard } from "./substitution-wizard";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default async function SubstitutionWizardPage({
  params,
}: {
  params: Promise<{ absenceId: string }>;
}) {
  const { absenceId } = await params;

  try {
    const data = await getSubstitutionPageData(absenceId);
    const dateStr = new Date(data.absence.date + "T12:00:00").toLocaleDateString("he-IL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

    return (
      <div className="space-y-5 max-w-2xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[13px] text-mifras-ink-400">
          <Link href="/absences" className="hover:text-mifras-orange-500 transition-colors">
            היעדרויות
          </Link>
          <ChevronLeft className="size-3.5" />
          <span className="text-mifras-ink-700 font-medium">
            מילוי מקום — {data.absence.teacher.name}
          </span>
        </div>

        {/* Header */}
        <div>
          <h1
            className="text-[24px] font-bold text-mifras-navy-700"
            style={{ fontFamily: "var(--font-rubik), system-ui, sans-serif" }}
          >
            מילוי מקום
          </h1>
          <p className="text-[13.5px] text-mifras-ink-400 mt-0.5">
            {data.absence.teacher.name} · {dateStr}
          </p>
        </div>

        <SubstitutionWizard absenceId={absenceId} data={data} />
      </div>
    );
  } catch {
    notFound();
  }
}
