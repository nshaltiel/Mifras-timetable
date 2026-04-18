import * as React from "react"
import { cn } from "@/lib/utils"

export interface EntityCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  avatar?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  chips?: React.ReactNode
  stats?: React.ReactNode
  actions?: React.ReactNode
}

export function EntityCard({
  avatar,
  title,
  subtitle,
  chips,
  stats,
  actions,
  className,
  ...props
}: EntityCardProps) {
  return (
    <div
      className={cn(
        "group flex flex-col gap-3 rounded-[14px] border border-mifras-ink-100 bg-white p-3.5 shadow-mifras-xs transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-px hover:shadow-mifras-sm hover:border-mifras-navy-300",
        className
      )}
      {...props}
    >
      <div className="flex items-start gap-3">
        {avatar ? <div className="shrink-0">{avatar}</div> : null}
        <div className="flex-1 min-w-0">
          <div
            className="text-[14.5px] font-bold text-mifras-navy-700 truncate"
            style={{ fontFamily: "var(--font-rubik), system-ui, sans-serif" }}
          >
            {title}
          </div>
          {subtitle ? (
            <div className="text-[12px] text-mifras-ink-500 truncate mt-0.5">
              {subtitle}
            </div>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {chips ? (
        <div className="flex flex-wrap items-center gap-1.5">{chips}</div>
      ) : null}
      {stats ? (
        <div className="pt-3 border-t border-dashed border-mifras-ink-100 text-[12px] text-mifras-ink-500">
          {stats}
        </div>
      ) : null}
    </div>
  )
}
