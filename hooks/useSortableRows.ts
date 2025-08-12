"use client"

import { useMemo, useState } from "react"
import type { ColumnStatistics } from "@/lib/api/types"

type SortDirection = "asc" | "desc"

type ComparableType = "number" | "boolean" | "string"

export function inferComparableType(columnId: string, columnsStats: Record<string, ColumnStatistics>): ComparableType {
  const statType = columnsStats[columnId]?.data_type
  if (statType) {
    const t = statType.toLowerCase()
    if (t.includes("float") || t.includes("int") || t === "decimal" || t === "number") return "number"
    if (t === "boolean" || t === "bool") return "boolean"
  }
  if (["monthly_rate_starting", "monthly_rate_instore", "admin_fee"].includes(columnId)) return "number"
  return "string"
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const n = Number(value.replace?.(/[^0-9.-]/g, ""))
    return Number.isNaN(n) ? null : n
  }
  return null
}

function toBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const s = value.toLowerCase().trim()
    if (["true", "yes", "1"].includes(s)) return true
    if (["false", "no", "0"].includes(s)) return false
  }
  return null
}

function toStringVal(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null
  return String(value)
}

function compareValues(a: unknown, b: unknown, type: ComparableType): number {
  const aNull = a === null || a === undefined || a === ""
  const bNull = b === null || b === undefined || b === ""
  if (aNull && !bNull) return 1
  if (!aNull && bNull) return -1
  if (aNull && bNull) return 0

  if (type === "number") {
    const an = toNumber(a)
    const bn = toNumber(b)
    if (an === null && bn !== null) return 1
    if (an !== null && bn === null) return -1
    if (an === null && bn === null) return 0
    return (an as number) - (bn as number)
  }

  if (type === "boolean") {
    const ab = toBoolean(a)
    const bb = toBoolean(b)
    if (ab === null && bb !== null) return 1
    if (ab !== null && bb === null) return -1
    if (ab === null && bb === null) return 0
    return ab === bb ? 0 : ab ? 1 : -1
  }

  const as = toStringVal(a)!.toLowerCase()
  const bs = toStringVal(b)!.toLowerCase()
  return as.localeCompare(bs)
}

export function useSortableRows<T extends Record<string, unknown>>(
  rows: T[],
  columnsStats: Record<string, ColumnStatistics>,
  initialSortBy: string | null = null,
  initialSortDir: SortDirection = "asc"
) {
  const [sortBy, setSortBy] = useState<string | null>(initialSortBy)
  const [sortDir, setSortDir] = useState<SortDirection>(initialSortDir)

  const sortedRows = useMemo(() => {
    if (!sortBy) return rows
    const type = inferComparableType(sortBy, columnsStats)
    const data = [...rows]
    data.sort((a, b) => {
      const cmp = compareValues(a[sortBy as keyof T], b[sortBy as keyof T], type)
      return sortDir === "asc" ? cmp : -cmp
    })
    return data
  }, [rows, sortBy, sortDir, columnsStats])

  const handleSortClick = (columnId: string) => {
    if (sortBy === columnId) {
      const nextDir: SortDirection = sortDir === "asc" ? "desc" : "asc"
      setSortDir(nextDir)
      // Keep sortBy same; explicitly set to ensure render in some batched cases
      setSortBy(columnId)
    } else {
      setSortBy(columnId)
      setSortDir("asc")
    }
  }

  return { sortedRows, sortBy, sortDir, handleSortClick, setSortBy, setSortDir }
}


