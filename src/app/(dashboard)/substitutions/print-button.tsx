"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <Button variant="outline" className="gap-1.5 print:hidden" onClick={() => window.print()}>
      <Printer className="size-3.5" />
      הדפסה
    </Button>
  );
}
