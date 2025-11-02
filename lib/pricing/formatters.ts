/**
 * Formats a snapshot date string for display
 * Handles "latest" special case and converts to localized date format
 */
export function formatSnapshotDate(selectedSnapshot: string, responseSnapshot?: string): string {
  const raw = selectedSnapshot === "latest" ? responseSnapshot : selectedSnapshot
  if (!raw) return "—"
  const dt = new Date(raw)
  if (Number.isNaN(dt.getTime())) return raw
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" })
}

/**
 * Generates a deterministic, pleasant HSL color for a competitor name
 * Uses string hashing to ensure consistent colors across renders
 */
export function getCompetitorColor(name: string | undefined): string {
  const str = (name ?? "").trim()
  if (str.length === 0) return "hsl(220 10% 70%)"
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  const hue = Math.abs(hash) % 360
  const saturation = 62
  const lightness = 46
  return `hsl(${hue} ${saturation}% ${lightness}%)`
}

/**
 * Formats a numeric value with optional currency formatting
 */
export function formatNumericValue(value: unknown, isCurrency: boolean): string | null {
  const numeric = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""))
  if (!Number.isFinite(numeric)) return null

  return isCurrency
    ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(numeric)
    : new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(numeric)
}

/**
 * Checks if a column ID is currency-like based on naming heuristics
 */
export function isCurrencyColumn(columnId?: string): boolean {
  return !!(columnId || "").toLowerCase().match(/(price|rate|fee|cost|amount|total)/)
}
