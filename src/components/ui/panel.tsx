import * as React from "react"
import { cn } from "@/lib/utils"

export function Panel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        "rounded-[14px] border border-mifras-ink-100 bg-white shadow-mifras-xs transition-shadow duration-200 hover:shadow-mifras-sm",
        className
      )}
      {...props}
    />
  )
}

export interface PanelHeadProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode
  title: React.ReactNode
  count?: React.ReactNode
  actions?: React.ReactNode
}

export function PanelHead({
  icon,
  title,
  count,
  actions,
  className,
  ...props
}: PanelHeadProps) {
  return (
    <header
      className={cn(
        "flex items-center justify-between gap-3 px-5 py-3.5 border-b border-mifras-ink-100",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {icon ? (
          <span className="inline-flex items-center justify-center size-8 rounded-[10px] bg-mifras-navy-50 text-mifras-navy-700 [&_svg]:size-4">
            {icon}
          </span>
        ) : null}
        <h3
          className="text-[15px] font-semibold text-mifras-navy-700 m-0 truncate"
          style={{ fontFamily: "var(--font-rubik), system-ui, sans-serif" }}
        >
          {title}
        </h3>
        {count !== undefined && count !== null ? (
          <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-semibold bg-mifras-navy-50 text-mifras-navy-700">
            {count}
          </span>
        ) : null}
      </div>
      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : null}
    </header>
  )
}

export function PanelBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />
}
