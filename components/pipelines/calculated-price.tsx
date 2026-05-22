import type { Adjuster } from '@/lib/adjusters'
import { calculatePrice } from '@/lib/adjusters'
import type { E1DataRow } from '@/lib/api/types'
import { getColumnLabel } from '@/lib/pricing/column-labels'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type FilterValue = string | number | boolean

export type CalculatedPriceRow = {
  comboMap: Record<string, FilterValue>
  price: number | null
}

export interface CalculatePriceTableParams {
  competitorData: E1DataRow[]
  clientAvailableUnits: number
  adjusters: Adjuster[]
  currentDate: Date
  filters?: Record<string, FilterSelection>
  combinatoricFlags?: Record<string, boolean>
}

export interface CalculatedPriceTableResult {
  rows: CalculatedPriceRow[]
  headers: string[]
}

function rowMatchesValue(cell: unknown, selected: FilterValue): boolean {
  if (cell === null || cell === undefined) return false
  if (Array.isArray(cell)) return cell.some((item) => String(item) === String(selected))
  return String(cell) === String(selected)
}

function cartesianProduct<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>(
    (acc, curr) => acc.flatMap(a => curr.map(b => [...a, b])),
    [[]]
  )
}

export type FilterSelection<T = FilterValue> =
  | { mode: 'all' }
  | { mode: 'subset'; values: T[] }

type SortDirection = 'asc' | 'desc'

interface CalculatedPriceProps {
  competitorData: E1DataRow[]
  clientAvailableUnits: number
  adjusters: Adjuster[]
  currentDate: Date
  filters?: Record<string, FilterSelection>
  availableFilterValues?: Record<string, FilterValue[]> 
  maxCombinations?: number
  combinatoricFlags?: Record<string, boolean>
  roundingEnabled?: boolean
  roundingOffset?: number
}

export function calculatePriceTable({
  competitorData,
  clientAvailableUnits,
  adjusters,
  currentDate,
  filters = {},
  combinatoricFlags = {},
}: CalculatePriceTableParams): CalculatedPriceTableResult {
  if (!adjusters || adjusters.length === 0) {
    return { rows: [], headers: ['Price'] }
  }

  const arrays: FilterValue[][] = []
  const humanKeys: string[] = []
  const columnNames: string[] = []
  const FILTER_KEY_TO_COLUMN: Record<string, string> = {
    competitors: 'competitor_name',
    locations: 'client_location',
    dimensions: 'unit_dimensions',
    unit_categories: 'unit_category',
  }

  const combinatoric: Array<{ key: string; values: FilterValue[]; column: string }> = []
  const preFilters: Array<{ column: string; values: FilterValue[] }> = []

  for (const [key, filter] of Object.entries(filters)) {
    if (!filter) continue
    if (filter.mode === 'subset') {
      const vals = (filter as { mode: 'subset'; values: FilterValue[] }).values ?? []
      if (!vals || vals.length === 0) continue
      const column = FILTER_KEY_TO_COLUMN[key] ?? key
      const isCombinatoric = combinatoricFlags ? Boolean(combinatoricFlags[key]) : true
      if (isCombinatoric) {
        combinatoric.push({ key, values: vals, column })
      } else {
        preFilters.push({ column, values: vals })
      }
    }
  }

  const applyPreFilters = (inputRows: E1DataRow[]): E1DataRow[] => {
    if (preFilters.length === 0) return inputRows
    let pool = inputRows
    for (const pf of preFilters) {
      const set = new Set(pf.values.map(String))
      pool = pool.filter((row) => {
        const val = (row as Record<string, unknown>)[pf.column]
        if (val === null || val === undefined) return false
        if (Array.isArray(val)) return val.some((item) => set.has(String(item)))
        return set.has(String(val))
      })
    }
    return pool
  }

  for (const c of combinatoric) {
    arrays.push(c.values)
    humanKeys.push(c.column)
    columnNames.push(c.column)
  }

  if (arrays.length === 0) {
    const pool = applyPreFilters(competitorData)

    let price: number | null = null
    try {
      const result = calculatePrice({
        competitorData: pool,
        clientUnit: { available_units: clientAvailableUnits },
        adjusters,
        currentDate,
      })
      if (result && typeof result.price === 'number' && !Number.isNaN(result.price)) {
        price = result.price
      }
    } catch (e) {
      console.error('[CalculatedPrice] Error for aggregate dataset (no combinatoric filters):', e)
    }

    if (price === null) {
      return { rows: [], headers: ['Price'] }
    }

    return {
      rows: [{ comboMap: {}, price }],
      headers: ['Price'],
    }
  }

  const combinations = cartesianProduct<FilterValue>(arrays)

  const resultRows = combinations
    .map((combo): CalculatedPriceRow => {
      let pool = competitorData
      pool = applyPreFilters(pool)

      const subset = pool.filter((row) =>
        columnNames.every((col, i) => rowMatchesValue((row as Record<string, unknown>)[col], combo[i]))
      )

      const comboMap = humanKeys.reduce<Record<string, FilterValue>>((acc, k, i) => {
        acc[k] = combo[i]
        return acc
      }, {})

      if (subset.length === 0) return { comboMap, price: null }

      let price: number | null = null
      try {
        const result = calculatePrice({
          competitorData: subset,
          clientUnit: { available_units: clientAvailableUnits },
          adjusters,
          currentDate,
        })
        if (result && typeof result.price === 'number' && !Number.isNaN(result.price)) {
          price = result.price
        }
      } catch (e) {
        console.error('[CalculatedPrice] Error for combo:', combo, e)
      }

      return { comboMap, price }
    })
    .filter((r) => r.price !== null)

  return {
    rows: resultRows,
    headers: [...humanKeys, 'Price'],
  }
}

export function CalculatedPrice({
  competitorData,
  clientAvailableUnits,
  adjusters,
  currentDate,
  filters = {},
  combinatoricFlags = {},
  roundingEnabled = false,
  roundingOffset = 0
}: CalculatedPriceProps) {
  const DEFAULT_COLUMN_WIDTH = 180
  const MIN_COLUMN_WIDTH = 120
  const noCompetitorData = !competitorData || competitorData.length === 0

  const normalizeRoundingOffset = (value: number) => {
    if (!Number.isFinite(value)) return 0
    const clamped = Math.min(1, Math.max(0, value))
    return clamped
  }

  const applyRounding = (value: number) => {
    if (!roundingEnabled || !Number.isFinite(value)) return value
    const offset = normalizeRoundingOffset(roundingOffset)
    const base = Math.round(value - offset)
    const next = base + offset
    return Object.is(next, -0) ? 0 : next
  }

  const formatNumeric = (value: number, forceFixed = false) => {
    const next = roundingEnabled ? applyRounding(value) : value
    if (forceFixed || roundingEnabled) return next.toFixed(2)
    return String(value)
  }

  const { rows, headers } = useMemo(
    () => calculatePriceTable({
      competitorData,
      clientAvailableUnits,
      adjusters,
      currentDate,
      filters,
      combinatoricFlags,
    }),
    [competitorData, clientAvailableUnits, adjusters, currentDate, filters, combinatoricFlags]
  )

  const [columnOrder, setColumnOrder] = useState<string[]>(headers)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [sortBy, setSortBy] = useState<string>('Price')
  const [sortDir, setSortDir] = useState<SortDirection>('asc')
  const dragColumnRef = useRef<string | null>(null)
  const resizeRef = useRef<{ column: string; startX: number; startWidth: number } | null>(null)

  useEffect(() => {
    const hasClientLocation = headers.includes('client_location')
    const hasPrice = headers.includes('Price')
    const middle = headers.filter((col) => col !== 'client_location' && col !== 'Price')
    const nextOrder = [
      ...(hasClientLocation ? ['client_location'] : []),
      ...middle,
      ...(hasPrice ? ['Price'] : []),
    ]
    setColumnOrder(nextOrder)
  }, [headers])

  const getColumnWidth = useCallback((columnId: string) => {
    return columnWidths[columnId] ?? DEFAULT_COLUMN_WIDTH
  }, [columnWidths])

  const getColumnCellStyle = useCallback((columnId: string) => {
    const width = getColumnWidth(columnId)
    return { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }
  }, [getColumnWidth])

  const handleResizeStart = useCallback((columnId: string, startX: number) => {
    resizeRef.current = {
      column: columnId,
      startX,
      startWidth: getColumnWidth(columnId),
    }
  }, [getColumnWidth])

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      const state = resizeRef.current
      if (!state) return
      const delta = event.clientX - state.startX
      const nextWidth = Math.max(MIN_COLUMN_WIDTH, Math.round(state.startWidth + delta))
      setColumnWidths((prev) => ({ ...prev, [state.column]: nextWidth }))
    }

    const onMouseUp = () => {
      resizeRef.current = null
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const handleDragStart = useCallback((columnId: string) => {
    dragColumnRef.current = columnId
  }, [])

  const handleDrop = useCallback((targetId: string) => {
    const sourceId = dragColumnRef.current
    dragColumnRef.current = null
    if (!sourceId || sourceId === targetId) return
    setColumnOrder((prev) => {
      const next = prev.filter((col) => col !== sourceId)
      const targetIndex = next.indexOf(targetId)
      if (targetIndex < 0) return prev
      next.splice(targetIndex, 0, sourceId)
      return next
    })
  }, [])

  const handleSortClick = useCallback((columnId: string) => {
    setSortBy((prev) => {
      if (prev === columnId) {
        setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
        return prev
      }
      setSortDir('asc')
      return columnId
    })
  }, [])

  const toComparable = useCallback((value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) return { kind: 'num' as const, num: value }
    if (typeof value === 'boolean') return { kind: 'num' as const, num: value ? 1 : 0 }
    const raw = String(value ?? '').trim()
    const numeric = Number(raw.replace(/[$,%\s,]/g, ''))
    if (raw !== '' && Number.isFinite(numeric)) return { kind: 'num' as const, num: numeric }
    return { kind: 'str' as const, str: raw.toLowerCase() }
  }, [])

  const sortedRows = useMemo(() => {
    const next = rows.map((row, index) => ({ row, index }))
    const dir = sortDir === 'asc' ? 1 : -1
    next.sort((a, b) => {
      const aVal = sortBy === 'Price' ? a.row.price : a.row.comboMap[sortBy]
      const bVal = sortBy === 'Price' ? b.row.price : b.row.comboMap[sortBy]
      const aCmp = toComparable(aVal)
      const bCmp = toComparable(bVal)

      if (aCmp.kind === 'num' && bCmp.kind === 'num') {
        return (aCmp.num - bCmp.num) * dir
      }

      const aStr = aCmp.kind === 'str' ? aCmp.str : String(aCmp.num)
      const bStr = bCmp.kind === 'str' ? bCmp.str : String(bCmp.num)
      return aStr.localeCompare(bStr) * dir
    })
    return next
  }, [rows, sortBy, sortDir, toComparable])

  if (!adjusters || adjusters.length === 0) {
    return <p className="text-muted-foreground">Add adjusters to calculate prices</p>
  }

  if (noCompetitorData) {
    return (
      <p className="text-muted-foreground">No data selected — adjust your filters to include competitor units.</p>
    )
  }

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground">
        No matching combinations (or no valid prices). Try turning off
        combinatoric for one filter, or select values that coexist.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
      <table className="w-full table-auto border border-gray-200">
        <thead className="bg-gray-100 sticky top-0 z-10">
          <tr>
            {columnOrder.map((h) => (
              <th
                key={h}
                className="relative border px-3 py-2 text-left text-sm font-semibold"
                style={getColumnCellStyle(h)}
                draggable
                onDragStart={() => handleDragStart(h)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleDrop(h)}
              >
                <div className="flex items-center gap-2">
                  <span className="cursor-move select-none">⋮⋮</span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-left hover:underline"
                    onClick={(event) => {
                      event.stopPropagation()
                      handleSortClick(h)
                    }}
                  >
                    <span>{h === 'Price' ? 'Price' : getColumnLabel(h, null)}</span>
                    {sortBy === h ? (
                      sortDir === 'asc' ? (
                        <ArrowUp className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 shrink-0" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                    )}
                  </button>
                </div>
                <div
                  className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize"
                  onMouseDown={(event) => handleResizeStart(h, event.clientX)}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map(({ row: r, index: originalIndex }) => (
            <tr id={`calculated-price-row-${originalIndex}`} data-calculated-row-index={originalIndex} key={originalIndex} className="even:bg-gray-50">
              {columnOrder.map((h) =>
                h === 'Price' ? (
                  <td key={h} className="border px-3 py-2 font-bold" style={getColumnCellStyle(h)}>
                    {`$${formatNumeric(r.price!, true)}`}
                  </td>
                ) : (
                  <td key={h} className="border px-3 py-2" style={getColumnCellStyle(h)}>
                    {typeof r.comboMap[h] === 'number'
                      ? formatNumeric(r.comboMap[h] as number)
                      : String(r.comboMap[h] ?? '-')}
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}