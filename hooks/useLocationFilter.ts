"use client"

import { useMemo } from "react"

export function useLocationFilter<T extends Record<string, unknown>>(
  rows: T[],
  selectedLocations: string[]
) {
  const allLocations = useMemo(() => {
    const names = new Set<string>()
    for (const row of rows) {
      const name = row["location_normalized"]
      if (typeof name === "string" && name.length > 0) {
        names.add(name)
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [rows])

  const filteredRows = useMemo(() => {
    if (!selectedLocations || selectedLocations.length === 0) return rows
    const selectedSet = new Set(selectedLocations)
    return rows.filter((r) => selectedSet.has(String(r["location_normalized"])) )
  }, [rows, selectedLocations])

  return { filteredRows, allLocations }
}


