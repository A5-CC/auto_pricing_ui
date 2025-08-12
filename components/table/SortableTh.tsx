"use client"

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"

type SortDirection = "asc" | "desc"

interface SortableThProps {
  columnId: string
  label: string
  sortBy: string | null
  sortDir: SortDirection
  onSortClick: (columnId: string) => void
  className?: string
}

export function SortableTh({ columnId, label, sortBy, sortDir, onSortClick, className }: SortableThProps) {
  const isActive = sortBy === columnId
  const ariaSort: "none" | "ascending" | "descending" = isActive ? (sortDir === "asc" ? "ascending" : "descending") : "none"

  return (
    <th className={className} aria-sort={ariaSort}>
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:underline"
        onClick={() => onSortClick(columnId)}
      >
        <span>{label}</span>
        {isActive ? (
          sortDir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
        )}
      </button>
    </th>
  )
}


