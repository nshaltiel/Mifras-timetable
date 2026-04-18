import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const statCardVariants = cva(
  "relative flex flex-col gap-2 rounded-[14px] border bg-white p-4 shadow-mifras-xs transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-mifras-sm",
  {
    variants: {
      variant: {
        accent: "border-mifras-orange-100",
        navy: "border-mifras-navy-100",
        gold: "border-mifras-gold-200",
        sky: "border-mifras-sky-100",
        neutral: "border-mifras-ink-100",
      },
    },
    defaultVariants: { variant: "neutral" },
  }
)

const iconTileVariants = cva(
  "inline-flex items-center justify-center rounded-[10px] size-[38px] [&_svg]:size-5",
  {
    variants: {
      variant: {
        accent: "bg-mifras-orange-50 text-mifras-orange-600",
        navy: "bg-mifras-navy-50 text-mifras-navy-700",
        gold: "bg-mifras-gold-50 text-mifras-gold-600",
        sky: "bg-mifras-sky-100 text-mifras-sky-500",
        neutral: "bg-mifras-ink-50 text-mifras-ink-500",
      },
    },
    defaultVariants: { variant: "neutral" },
  }
)

export interface StatCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statCardVariants> {
  icon?: React.ReactNode
  value: React.ReactNode
  label: React.ReactNode
  trend?: React.ReactNode
}

export function StatCard({
  variant,
  icon,
  value,
  label,
  trend,
  className,
  ...props
}: StatCardProps) {
  return (
    <div className={cn(statCardVariants({ variant }), className)} {...props}>
      {icon ? (
        <span className={iconTileVariants({ variant })}>{icon}</span>
      ) : null}
      <div
        className="text-[30px] leading-none font-bold text-mifras-navy-700"
        style={{ fontFamily: "var(--font-rubik), system-ui, sans-serif" }}
      >
        {value}
      </div>
      <div className="text-[12.5px] text-mifras-ink-500">{label}</div>
      {trend ? (
        <div className="text-[12px] text-mifras-success font-medium mt-0.5">
          {trend}
        </div>
      ) : null}
    </div>
  )
}
