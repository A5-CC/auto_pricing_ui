"use client"

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { useRef } from "react"

type SortDirection = "asc" | "desc"

interface SortableThProps {
  columnId: string
  label: string
  sortBy: string | null
  sortDir: SortDirection
  onSortClick: (columnId: string) => void
  className?: string
  width?: number
  minWidth?: number
  onResizeStart?: (columnId: string, startX: number, startWidth: number) => void
}

export function SortableTh({
  columnId,
  label,
  sortBy,
  sortDir,
  onSortClick,
  className,
  width,
  minWidth,
  onResizeStart,
}: SortableThProps) {
  const thRef = useRef<HTMLTableCellElement | null>(null)
  const isActive = sortBy === columnId
  const ariaSort: "none" | "ascending" | "descending" = isActive ? (sortDir === "asc" ? "ascending" : "descending") : "none"

  return (
    <th
      ref={thRef}
      className={onResizeStart ? `relative ${className ?? ''}`.trim() : className}
      aria-sort={ariaSort}
      style={width ? { width: `${width}px`, minWidth: `${minWidth ?? width}px`, maxWidth: `${width}px` } : undefined}
    >
      <button
        type="button"
        className="flex w-full items-start gap-1 text-left hover:underline"
        onClick={() => onSortClick(columnId)}
      >
        <span className="whitespace-normal break-words leading-tight">{label}</span>
        {isActive ? (
          sortDir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 shrink-0" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        )}
      </button>
      {onResizeStart && (
        <span
          role="separator"
          aria-orientation="vertical"
          aria-label={`Resize ${label} column`}
          className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none"
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const startWidth = thRef.current?.getBoundingClientRect().width ?? width ?? 160
            onResizeStart(columnId, e.clientX, startWidth)
          }}
        />
      )}
    </th>
  )
}


