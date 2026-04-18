"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface PillTabItem<T extends string = string> {
  value: T
  label: React.ReactNode
  icon?: React.ReactNode
  count?: number | string
}

export interface PillTabsProps<T extends string = string> {
  items: PillTabItem<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  size?: "sm" | "md"
}

export function PillTabs<T extends string = string>({
  items,
  value,
  onChange,
  className,
  size = "md",
}: PillTabsProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-mifras-ink-100 p-1",
        className
      )}
    >
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(item.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full transition-colors whitespace-nowrap font-medium",
              size === "sm"
                ? "h-7 px-3 text-[12px]"
                : "h-8 px-3.5 text-[13px]",
              active
                ? "bg-white text-mifras-navy-700 shadow-mifras-xs font-semibold"
                : "text-mifras-ink-500 hover:text-mifras-navy-700"
            )}
          >
            {item.icon ? (
              <span className="[&_svg]:size-3.5">{item.icon}</span>
            ) : null}
            <span>{item.label}</span>
            {item.count !== undefined ? (
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10.5px] font-semibold",
                  active
                    ? "bg-mifras-orange-50 text-mifras-orange-700"
                    : "bg-white text-mifras-ink-500"
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
