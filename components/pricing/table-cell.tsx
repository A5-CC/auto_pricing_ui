import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatNumericValue, isCurrencyColumn } from "@/lib/pricing/formatters"

interface TableCellProps {
  value: unknown
  type?: string
  columnId?: string
}

/**
 * Renders a table cell with type-aware formatting
 * Handles nulls, numbers, currency, booleans, and strings with truncation
 */
export function TableCell({ value, type, columnId }: TableCellProps) {
  // Empty values
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground/70">—</span>
  }

  const normalizedType = (type || "").toLowerCase()
  const isNumeric = normalizedType.includes("float") || normalizedType.includes("int") || normalizedType === "decimal" || normalizedType === "number"
  const isBoolean = normalizedType === "boolean" || normalizedType === "bool"

  if (isNumeric) {
    const formatted = formatNumericValue(value, isCurrencyColumn(columnId))
    if (formatted) {
      return <span className="tabular-nums">{formatted}</span>
    }
  }

  if (isBoolean) {
    const b = typeof value === "boolean" ? value : String(value).toLowerCase() === "true"
    const label = b ? "Yes" : "No"
    return (
      <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${b ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`} aria-label={label}>
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${b ? "bg-emerald-500" : "bg-slate-400"}`} />
        <span>{label}</span>
      </span>
    )
  }

  const str = String(value)
  if (str.length > 40) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-block max-w-[28ch] truncate align-top" aria-label={str}>{str}</span>
        </TooltipTrigger>
        <TooltipContent sideOffset={4}>{str}</TooltipContent>
      </Tooltip>
    )
  }
  return str
}
