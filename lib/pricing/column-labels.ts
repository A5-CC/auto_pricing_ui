import type { PricingSchemas } from "@/lib/api/types"

/**
 * Resolves a user-friendly label for a column ID
 * Priority: spine label > canonical label > formatted column ID
 */
export function getColumnLabel(columnId: string, pricingSchemas: PricingSchemas | null): string {
  if (!pricingSchemas) return columnId

  // Check spine columns first
  const spineColumn = pricingSchemas.spine?.find(col => col.id === columnId)
  if (spineColumn?.label) return spineColumn.label

  // Check canonical columns
  const canonicalColumn = pricingSchemas.canonical?.columns?.[columnId]
  if (canonicalColumn?.label) return canonicalColumn.label

  // Fallback to formatted column ID
  return columnId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

/**
 * Prefer the canonical schema label if present; otherwise fall back to `getColumnLabel`.
 */
export function getCanonicalLabel(columnId: string, pricingSchemas: PricingSchemas | null): string {
  if (!pricingSchemas) return columnId
  const canonicalColumn = pricingSchemas.canonical?.columns?.[columnId]
  if (canonicalColumn?.label) return canonicalColumn.label
  return getColumnLabel(columnId, pricingSchemas)
}
