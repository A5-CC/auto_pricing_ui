"use client"

import { useMemo } from "react"

export function useCompetitorFilter<T extends Record<string, unknown>>(
  rows: T[],
  selectedCompetitors: string[]
) {
  const allCompetitors = useMemo(() => {
    const names = new Set<string>()
    for (const row of rows) {
      const name = row["competitor_name"]
      if (typeof name === "string" && name.length > 0) {
        names.add(name)
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [rows])

  const filteredRows = useMemo(() => {
    if (!selectedCompetitors || selectedCompetitors.length === 0) return rows
    const selectedSet = new Set(selectedCompetitors)
    return rows.filter((r) => selectedSet.has(String(r["competitor_name"])) )
  }, [rows, selectedCompetitors])

  return { filteredRows, allCompetitors }
}


