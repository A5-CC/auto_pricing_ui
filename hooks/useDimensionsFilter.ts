"use client"

import { useMemo } from "react"

export function useDimensionsFilter<T extends Record<string, unknown>>(
  rows: T[],
  selectedDimensions: string[],
  columnKey: string = "dimensions_normalized"
) {
  const allDimensions = useMemo(() => {
    const names = new Set<string>()
    for (const row of rows) {
      const value = row[columnKey]
      if (typeof value === "string" && value.length > 0) {
        names.add(value)
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
  }, [rows, columnKey])

  const filteredRows = useMemo(() => {
    if (!selectedDimensions || selectedDimensions.length === 0) return rows
    const selectedSet = new Set(selectedDimensions)
    return rows.filter((r) => selectedSet.has(String(r[columnKey])) )
  }, [rows, selectedDimensions, columnKey])

  return { filteredRows, allDimensions }
}


