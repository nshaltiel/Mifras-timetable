import { getSubstitutionPageData } from "@/lib/substitution-actions";
import { SubstitutionWizard } from "./substitution-wizard";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default async function SubstitutionWizardPage({
  params,
}: {
  params: Promise<{ absenceId: string }>;
}) {
  const { absenceId } = await params;

  try {
    const data = await getSubstitutionPageData(absenceId);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/absences" className="hover:text-foreground transition-colors">
            היעדרויות
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">מילוי מקום — {data.absence.teacher.name}</span>
        </div>
        <h2 className="text-2xl font-bold">
          מילוי מקום: {data.absence.teacher.name} — {new Date(data.absence.date + "T12:00:00").toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}
        </h2>
        <SubstitutionWizard absenceId={absenceId} data={data} />
      </div>
    );
  } catch {
    notFound();
  }
}
