"use client"

import { useMemo } from "react"

export function useLocationFilter<T extends Record<string, unknown>>(
  rows: T[],
  selectedLocations: string[],
  columnKey: string = "modstorage_location"
) {
  const allLocations = useMemo(() => {
    const names = new Set<string>()
    for (const row of rows) {
      const name = row[columnKey]
      if (typeof name === "string" && name.length > 0) {
        names.add(name)
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [rows, columnKey])

  const filteredRows = useMemo(() => {
    if (!selectedLocations || selectedLocations.length === 0) return rows
    const selectedSet = new Set(selectedLocations)
    return rows.filter((r) => selectedSet.has(String(r[columnKey])) )
  }, [rows, selectedLocations, columnKey])

  return { filteredRows, allLocations }
}


