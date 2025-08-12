"use client"

import { useMemo } from "react"

export function useUnitCategoryFilter<T extends Record<string, unknown>>(
  rows: T[],
  selectedCategories: string[]
) {
  const allUnitCategories = useMemo(() => {
    const names = new Set<string>()
    for (const row of rows) {
      const value = row["unit_category"]
      if (typeof value === "string" && value.length > 0) {
        names.add(value)
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
  }, [rows])

  const filteredRows = useMemo(() => {
    if (!selectedCategories || selectedCategories.length === 0) return rows
    const selectedSet = new Set(selectedCategories)
    return rows.filter((r) => selectedSet.has(String(r["unit_category"])) )
  }, [rows, selectedCategories])

  return { filteredRows, allUnitCategories }
}


