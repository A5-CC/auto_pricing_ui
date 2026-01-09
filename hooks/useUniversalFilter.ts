"use client"

import { useMemo } from "react"

export function useUniversalFilter<T extends Record<string, unknown>>(
  rows: T[],
  columnKey: string
) {
  const allValues = useMemo(() => {
    const s = new Set<string>()
    if (!rows || !columnKey) return [] as string[]
    for (const r of rows) {
      const v = r[columnKey as keyof T]
      if (v === null || v === undefined) continue
      if (Array.isArray(v)) {
        for (const x of v) if (typeof x === "string" && x.length) s.add(x)
      } else {
        const str = typeof v === "string" ? v : String(v)
        if (str.length) s.add(str)
      }
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
  }, [rows, columnKey])

  const filterRows = (rowsToFilter: T[], selectedValues: string[]) => {
    if (!selectedValues || selectedValues.length === 0) return rowsToFilter
    const sel = new Set(selectedValues)
    return rowsToFilter.filter((r) => {
      const v = r[columnKey as keyof T]
      if (v === null || v === undefined) return false
      if (Array.isArray(v)) {
        return v.some((x) => sel.has(String(x)))
      }
      return sel.has(String(v))
    })
  }

  return { allValues, filterRows }
}
"use client"

import { useMemo } from "react"

export function useUniversalFilter<T extends Record<string, unknown>>(
  rows: T[],
  columnKey: string
) {
  const allValues = useMemo(() => {
    const s = new Set<string>()
    for (const r of rows) {
      const v = r[columnKey as keyof T]
      if (v === null || v === undefined) continue
      if (Array.isArray(v)) {
        for (const x of v) if (typeof x === "string" && x.length) s.add(x)
      } else {
        const str = typeof v === "string" ? v : String(v)
        if (str.length) s.add(str)
      }
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
  }, [rows, columnKey])

  const filterRows = (rowsToFilter: T[], selectedValues: string[]) => {
    if (!selectedValues || selectedValues.length === 0) return rowsToFilter
    const sel = new Set(selectedValues)
    return rowsToFilter.filter((r) => {
      const v = r[columnKey as keyof T]
      if (v === null || v === undefined) return false
      if (Array.isArray(v)) {
        return v.some((x) => sel.has(String(x)))
      }
      return sel.has(String(v))
    })
  }

  return { allValues, filterRows }
}