"use client"


import { normalizeFilterValue, toFilterDisplayValue } from "@/lib/pricing/filter-value-normalization"
import { useMemo } from "react"

export function useUniversalFilter<T extends Record<string, unknown>>(
  rows: T[],
  columnKey: string
) {
  const allValues = useMemo(() => {
    const canonicalByNormalized = new Map<string, string>()
    if (!rows || !columnKey) return [] as string[]

    const addValue = (candidate: unknown) => {
      const display = toFilterDisplayValue(candidate)
      if (!display) return
      const normalized = normalizeFilterValue(display)
      if (!normalized) return
      if (!canonicalByNormalized.has(normalized)) {
        canonicalByNormalized.set(normalized, display)
      }
    }

    for (const r of rows) {
      const v = r[columnKey as keyof T]
      if (v === null || v === undefined) continue
      if (Array.isArray(v)) {
        for (const x of v) addValue(x)
      } else {
        addValue(v)
      }
    }

    return Array.from(canonicalByNormalized.values()).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    )
  }, [rows, columnKey])

  const filterRows = (rowsToFilter: T[], selectedValues: string[]) => {
    if (!selectedValues || selectedValues.length === 0) return rowsToFilter
    const sel = new Set(selectedValues.map(normalizeFilterValue).filter(Boolean))
    return rowsToFilter.filter((r) => {
      const v = r[columnKey as keyof T]
      if (v === null || v === undefined) return false
      if (Array.isArray(v)) {
        return v.some((x) => sel.has(normalizeFilterValue(x)))
      }
      return sel.has(normalizeFilterValue(v))
    })
  }

  return { allValues, filterRows }
}