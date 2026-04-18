import * as React from "react"
import { cn } from "@/lib/utils"

export interface PageHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
}

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-4 pb-6 mb-6 border-b border-mifras-ink-100",
        className
      )}
      {...props}
    >
      <div className="flex-1 min-w-0">
        <h1
          className="text-[28px] leading-tight font-bold text-mifras-navy-700 m-0"
          style={{ fontFamily: "var(--font-rubik), system-ui, sans-serif" }}
        >
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1.5 text-[13.5px] text-mifras-ink-500 m-0">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex items-center gap-2.5 flex-wrap">{actions}</div>
      ) : null}
    </div>
  )
}
