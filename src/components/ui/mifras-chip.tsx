import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const chipVariants = cva(
  "inline-flex items-center gap-1 rounded-lg px-2 h-[22px] text-[11.5px] font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        navy: "bg-mifras-navy-50 text-mifras-navy-700",
        accent: "bg-mifras-orange-50 text-mifras-orange-700",
        gold: "bg-mifras-gold-50 text-mifras-gold-600",
        sky: "bg-mifras-sky-100 text-mifras-sky-500",
        ghost: "bg-mifras-ink-50 text-mifras-ink-700",
        success: "bg-emerald-50 text-mifras-success",
        danger: "bg-red-50 text-mifras-danger",
      },
    },
    defaultVariants: { tone: "ghost" },
  }
)

export interface ChipProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof chipVariants> {}

export function Chip({ tone, className, ...props }: ChipProps) {
  return <span className={cn(chipVariants({ tone }), className)} {...props} />
}
