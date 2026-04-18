import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const statusPillVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 h-[22px] text-[11.5px] font-semibold whitespace-nowrap",
  {
    variants: {
      tone: {
        done: "bg-emerald-50 text-mifras-success",
        partial: "bg-mifras-gold-50 text-mifras-gold-600",
        open: "bg-red-50 text-mifras-danger",
        info: "bg-mifras-navy-50 text-mifras-navy-700",
        neutral: "bg-mifras-ink-100 text-mifras-ink-700",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
)

export interface StatusPillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusPillVariants> {}

export function StatusPill({
  tone,
  className,
  ...props
}: StatusPillProps) {
  return (
    <span
      className={cn(statusPillVariants({ tone }), className)}
      {...props}
    />
  )
}
