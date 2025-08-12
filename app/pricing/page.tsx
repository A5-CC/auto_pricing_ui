"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import {
  getPricingSnapshots,
  getPricingData,
  exportPricingCSV,
  getColumnStatistics,
  getPricingSchemas,
} from "@/lib/api/client"
import type {
  PricingSnapshot,
  PricingDataResponse,
  ColumnStatistics,
  PricingSchemas,
} from "@/lib/api/types"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ContextChips } from "@/components/context-chips"
import { useContextChips } from "@/hooks/useContextChips"
import { TypeCountBadge } from "@/components/pricing/type-count-badge"
import { AddressCell } from "@/components/pricing/address-cell"
import { SortableTh } from "@/components/table/SortableTh"
import { useSortableRows } from "@/hooks/useSortableRows"
import { useCompetitorFilter } from "@/hooks/useCompetitorFilter"
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectGroup,
  MultiSelectItem,
  MultiSelectTrigger,
  MultiSelectValue,
} from "@/components/ui/multi-select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import GroupByControl from "@/components/pricing/group-by-control"
// import { Badge } from "@/components/ui/badge"


export default function PricingPage() {
  const [snapshots, setSnapshots] = useState<PricingSnapshot[]>([])
  const [selectedSnapshot, setSelectedSnapshot] = useState<string>("latest")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Client-side competitor multi-select
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([])

  const [dataResponse, setDataResponse] = useState<PricingDataResponse | null>(null)
  const [columnsStats, setColumnsStats] = useState<Record<string, ColumnStatistics>>({})
  const [visibleColumns, setVisibleColumns] = useState<string[]>([])
  const [pricingSchemas, setPricingSchemas] = useState<PricingSchemas | null>(null)

  // Client-side filtering (competitors)
  const { filteredRows, allCompetitors } = useCompetitorFilter(dataResponse?.data ?? [], selectedCompetitors)

  // Sorting on filtered rows
  const { sortedRows: displayedRows, sortBy, sortDir, handleSortClick, setSortBy, setSortDir } = useSortableRows(
    filteredRows,
    columnsStats,
    null,
    "asc"
  )

  // Group by (single level)
  const [groupBy, setGroupBy] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const { createChips } = useContextChips()

  const grouped = useMemo(() => {
    if (!groupBy) return null
    const map = new Map<string, typeof displayedRows>()
    for (const row of displayedRows) {
      const raw = row[groupBy as keyof typeof row]
      const key = raw === null || raw === undefined || raw === "" ? "—" : String(raw)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(row)
    }
    const keys = Array.from(map.keys()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
    return { keys, map }
  }, [displayedRows, groupBy])

  // Auto-expand groups only when grouping mode changes
  useEffect(() => {
    if (!groupBy) {
      setExpandedGroups(new Set())
      return
    }
    if (grouped) setExpandedGroups(new Set(grouped.keys))
  }, [groupBy])

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const expandAllGroups = () => {
    if (grouped) setExpandedGroups(new Set(grouped.keys))
  }
  const collapseAllGroups = () => setExpandedGroups(new Set())

  const loadSnapshots = async () => {
    try {
      const s = await getPricingSnapshots()
      setSnapshots(s)
    } catch {
      // silently ignore
    }
  }

  const loadSchemas = async () => {
    try {
      const schemas = await getPricingSchemas()
      setPricingSchemas(schemas)
    } catch {
      // silently ignore
    }
  }

  useEffect(() => {
    loadSnapshots()
    loadSchemas()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch full snapshot (no backend filters); keep a generous limit
      const res = await getPricingData(selectedSnapshot, { limit: 1000 })
      setDataResponse(res)
      if (res.columns?.length) {
        // Get statistics for ALL columns that are being displayed
        const stats = await getColumnStatistics(selectedSnapshot, res.columns)
        const byName = Object.fromEntries(stats.map((s) => [s.column, s]))
        setColumnsStats(byName)

        // Filter out columns that are already shown in fixed columns
        const fixedColumns = ['competitor_name', 'competitor_address', 'modstorage_location', 'snapshot_date', 'unit_dimensions']
        const filteredColumns = res.columns.filter(col => !fixedColumns.includes(col))
        setVisibleColumns((prev) => (prev.length ? prev : filteredColumns))
      }
    } catch {
      setError("Failed to load pricing data")
    } finally {
      setLoading(false)
    }
  }

  // Reload when inputs change (snapshot only)
  useEffect(() => {
    loadData()
  }, [selectedSnapshot])

  const onExport = async () => {
    if (!selectedSnapshot) return
    // Export via backend (full snapshot, selected columns). If needed, later we can export client-side filtered rows.
    const blob = await exportPricingCSV(selectedSnapshot, { columns: visibleColumns })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `pricing-${selectedSnapshot}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Deterministic, pleasant color per competitor
  function getCompetitorColor(name: string | undefined): string {
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

  // Get column label from schema
  const getColumnLabel = (columnId: string): string => {
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

  // Reset sort when dataset changes significantly (e.g., new snapshot or filters)
  useEffect(() => {
    setSortBy(null)
    setSortDir("asc")
  }, [selectedSnapshot, selectedCompetitors])


  return (
    <main className="mx-auto max-w-7xl p-6 space-y-5">
      <ContextChips
        chips={createChips(
          {
            label: "Pricing",
            isCurrent: true
          }
        )}
      />
      <header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Explore normalized competitor unit pricing with dynamic columns.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onExport} disabled={!dataResponse}>Export CSV</Button>
          </div>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Overview subheader + compact stats strip */}
      <SectionLabel
        text="Overview"
        right={(
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="hidden sm:inline">Snapshot</span>
            <select
              className="rounded-md border px-2 py-1 text-sm outline-none focus-visible:border-ring"
              value={selectedSnapshot}
              onChange={(e) => setSelectedSnapshot(e.target.value)}
              aria-label="Select snapshot"
            >
              <option value="latest">Latest</option>
              {snapshots.map((s) => (
                <option key={s.date} value={s.date}>{s.date}</option>
              ))}
            </select>
          </div>
        )}
      />
      <section className="rounded-lg border bg-background/50 p-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <div className="text-muted-foreground">Snapshot</div>
          <div className="font-medium">
            {formatSnapshotDate(selectedSnapshot, dataResponse?.snapshot_date)}
          </div>
          <div className="hidden sm:block h-4 w-px bg-border" />
          <div className="text-muted-foreground">Rows</div>
          <div className="font-medium tabular-nums">{dataResponse ? dataResponse.total_rows.toLocaleString() : "—"}</div>
          <div className="hidden sm:block h-4 w-px bg-border" />
          <div className="text-muted-foreground">Facilities</div>
          <div className="font-medium tabular-nums">{dataResponse ? dataResponse.total_facilities.toLocaleString() : "—"}</div>
          <div className="hidden sm:block h-4 w-px bg-border" />
          <div className="text-muted-foreground">Columns</div>
          <div className="font-medium tabular-nums">{dataResponse?.columns?.length ?? "—"}</div>
          {!!Object.keys(columnsStats).length && (
            <div className="hidden md:flex items-center gap-1">
              {getTypeCounts(columnsStats).slice(0, 4).map(([type, count]) => (
                <TypeCountBadge key={type} type={type} count={count} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Filters */}
      <SectionLabel text="Filters" />
      <section className="rounded-lg border bg-background/50 p-3">
        <div className="grid gap-3 sm:grid-cols-[minmax(18rem,24rem)]">
          {/* Competitors multi-select */}
          <div className="min-w-0">
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-xs text-muted-foreground">Competitors</label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCompetitors([])}
                disabled={selectedCompetitors.length === 0}
                aria-label="Clear selected competitors"
              >
                Clear
              </Button>
            </div>
            <MultiSelect values={selectedCompetitors} onValuesChange={setSelectedCompetitors}>
              <MultiSelectTrigger className="w-full justify-between">
                <MultiSelectValue placeholder="Select competitors" />
              </MultiSelectTrigger>
              <MultiSelectContent search={{ placeholder: "Search competitors...", emptyMessage: "No competitors" }}>
                <MultiSelectGroup>
                  {allCompetitors.map((name) => (
                    <MultiSelectItem key={name} value={name}>{name}</MultiSelectItem>
                  ))}
                </MultiSelectGroup>
              </MultiSelectContent>
            </MultiSelect>
          </div>

        </div>
      </section>

      {/* Display controls */}
      <SectionLabel
        text="Display"
        right={(
          <GroupByControl
            className="min-w-[220px]"
            fullWidth={false}
            value={groupBy}
            onChange={setGroupBy}
            onExpandAll={groupBy ? expandAllGroups : undefined}
            onCollapseAll={groupBy ? collapseAllGroups : undefined}
            options={[
              { id: "competitor_name", label: "Competitor" },
              { id: "modstorage_location", label: "Location" },
              { id: "unit_dimensions", label: "Unit" },
            ]}
          />
        )}
      />

      <section className="space-y-3">

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <SortableTh
                  columnId="competitor_name"
                  label="Competitor"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSortClick={handleSortClick}
                  className="px-4 py-2 sticky left-0 z-20 bg-background border-r w-[280px] min-w-[280px] max-w-[280px]"
                />
                <SortableTh
                  columnId="modstorage_location"
                  label="ModLocation"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSortClick={handleSortClick}
                  className="px-4 py-2 w-[240px] min-w-[240px] max-w-[240px]"
                />
                <SortableTh
                  columnId="unit_dimensions"
                  label="Dimensions"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSortClick={handleSortClick}
                  className="px-4 py-2"
                />
                {visibleColumns.map((c) => (
                  <SortableTh
                    key={c}
                    columnId={c}
                    label={getColumnLabel(c)}
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSortClick={handleSortClick}
                    className="px-4 py-2 whitespace-nowrap"
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="border-t">
                    <td className="px-4 py-2"><div className="h-4 w-28 animate-pulse rounded bg-muted" /></td>
                    <td className="px-4 py-2"><div className="h-4 w-40 animate-pulse rounded bg-muted" /></td>
                    <td className="px-4 py-2"><div className="h-4 w-16 animate-pulse rounded bg-muted" /></td>
                    {Array.from({ length: Math.min(visibleColumns.length || 6, 6) }).map((_, j) => (
                      <td key={`s-${i}-${j}`} className="px-4 py-2"><div className="h-4 w-24 animate-pulse rounded bg-muted" /></td>
                    ))}
                  </tr>
                ))
              ) : (groupBy && grouped ? (
                grouped.keys.map((key) => (
                  <Fragment key={`group-frag-${key}`}>
                    <tr className="border-t bg-muted/30">
                      <td className="px-4 py-2" colSpan={3 + (visibleColumns.length || 0)}>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 font-medium text-muted-foreground hover:text-foreground"
                          onClick={() => toggleGroup(key)}
                          aria-expanded={expandedGroups.has(key)}
                          aria-controls={`group-body-${key}`}
                        >
                          <span className="inline-block h-2 w-2 rounded-full bg-border" />
                          <span className="uppercase text-[11px] tracking-wide">{getColumnLabel(groupBy)}</span>
                          <span className="text-foreground">{key}</span>
                          <span className="text-xs text-muted-foreground">({grouped.map.get(key)?.length ?? 0})</span>
                        </button>
                      </td>
                    </tr>
                    {expandedGroups.has(key) && (grouped.map.get(key) ?? []).map((row, idx) => (
                      <tr key={`${key}-${idx}`} className="border-t align-top" id={`group-body-${key}`}>
                        <td
                          className="px-4 py-2 whitespace-nowrap sticky left-0 z-10 bg-background border-r w-[280px] min-w-[280px] max-w-[280px]"
                        >
                          <div className="space-y-0.5">
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                aria-hidden="true"
                                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/5"
                                style={{ backgroundColor: getCompetitorColor(String(row.competitor_name)) }}
                              />
                              <span className="font-medium truncate" title={row.competitor_name}>{row.competitor_name}</span>
                            </div>
                            <div className="text-xs text-muted-foreground truncate" title={row.competitor_address}>{row.competitor_address}</div>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <AddressCell address={row.modstorage_location} />
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">{row.unit_dimensions || "—"}</td>
                        {visibleColumns.map((c) => (
                          <td key={`${idx}-${c}`} className="px-4 py-2">{formatCellValue(row[c], columnsStats[c]?.data_type, c)}</td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))
              ) : (displayedRows?.length ? (
                displayedRows.map((row, idx) => (
                  <tr key={`${row.modstorage_location}-${idx}`} className="border-t align-top">
                    <td
                      className="px-4 py-2 whitespace-nowrap sticky left-0 z-10 bg-background border-r w-[280px] min-w-[280px] max-w-[280px]"
                    >
                      <div className="space-y-0.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/5"
                            style={{ backgroundColor: getCompetitorColor(String(row.competitor_name)) }}
                          />
                          <span className="font-medium truncate" title={row.competitor_name}>{row.competitor_name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate" title={row.competitor_address}>{row.competitor_address}</div>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <AddressCell address={row.modstorage_location} />
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">{row.unit_dimensions || "—"}</td>
                    {visibleColumns.map((c) => (
                      <td key={`${idx}-${c}`} className="px-4 py-2">{formatCellValue(row[c], columnsStats[c]?.data_type, c)}</td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-center text-muted-foreground" colSpan={3 + (visibleColumns.length || 0)}>No results. Broaden filters.</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

function formatSnapshotDate(selectedSnapshot: string, responseSnapshot?: string): string {
  const raw = selectedSnapshot === "latest" ? responseSnapshot : selectedSnapshot
  if (!raw) return "—"
  const dt = new Date(raw)
  if (Number.isNaN(dt.getTime())) return raw
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" })
}

function getTypeCounts(columnsStats: Record<string, ColumnStatistics>): [string, number][] {
  const typeCounts: Record<string, number> = {}

  Object.values(columnsStats).forEach(stat => {
    const type = stat.data_type
    typeCounts[type] = (typeCounts[type] || 0) + 1
  })

  const typeOrder = ['float64', 'Int64', 'boolean', 'string']
  return Object.entries(typeCounts)
    .sort(([typeA, countA], [typeB, countB]) => {
      if (countA !== countB) return countB - countA
      const aIndex = typeOrder.indexOf(typeA)
      const bIndex = typeOrder.indexOf(typeB)
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex)
    })
}

function formatCellValue(value: unknown, type?: string, columnId?: string) {
  // Empty values
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground/70">—</span>
  }

  const normalizedType = (type || "").toLowerCase()
  const isNumeric = normalizedType.includes("float") || normalizedType.includes("int") || normalizedType === "decimal" || normalizedType === "number"
  const isBoolean = normalizedType === "boolean" || normalizedType === "bool"

  // Heuristic: currency-like columns
  const isCurrencyLike = (columnId || "").toLowerCase().match(/(price|rate|fee|cost|amount|total)/)

  if (isNumeric) {
    const numeric = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""))
    if (Number.isFinite(numeric)) {
      const formatted = isCurrencyLike
        ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(numeric)
        : new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(numeric)
      return <span className="tabular-nums">{formatted}</span>
    }
  }

  if (isBoolean) {
    const b = typeof value === "boolean" ? value : String(value).toLowerCase() === "true"
    const label = b ? "Yes" : "No"
    return (
      <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${b ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`} aria-label={label}>
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${b ? "bg-emerald-500" : "bg-slate-400"}`} />
        <span>{label}</span>
      </span>
    )
  }

  const str = String(value)
  if (str.length > 40) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-block max-w-[28ch] truncate align-top" aria-label={str}>{str}</span>
        </TooltipTrigger>
        <TooltipContent sideOffset={4}>{str}</TooltipContent>
      </Tooltip>
    )
  }
  return str
}

function SectionLabel({ text, right }: { text: string; right?: React.ReactNode }) {
  return (
    <div className="mt-1 mb-2 flex items-center justify-between">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{text}</div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  )
}



