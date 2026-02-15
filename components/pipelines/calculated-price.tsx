import type { Adjuster } from '@/lib/adjusters'
import { calculatePrice } from '@/lib/adjusters'
import type { E1DataRow } from '@/lib/api/types'
import { useMemo } from 'react'

type FilterValue = string | number | boolean

type ResultRow = {
  comboMap: Record<string, FilterValue>
  price: number | null
}

function cartesianProduct<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>(
    (acc, curr) => acc.flatMap(a => curr.map(b => [...a, b])),
    [[]]
  )
}

type FilterSelection<T = FilterValue> =
  | { mode: 'all' }
  | { mode: 'subset'; values: T[] }

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
  const noCompetitorData = !competitorData || competitorData.length === 0

  const normalizeRoundingOffset = (value: number) => {
    if (!Number.isFinite(value)) return 0
    const clamped = Math.min(1, Math.max(-0.5, value))
    return clamped > 0.5 ? 1 : clamped
  }

  const applyRounding = (value: number) => {
    if (!roundingEnabled || !Number.isFinite(value)) return value
    const base = Math.floor(value)
    const offset = normalizeRoundingOffset(roundingOffset)
    const next = base + offset
    return Object.is(next, -0) ? 0 : next
  }

  const formatNumeric = (value: number, forceFixed = false) => {
    const next = roundingEnabled ? applyRounding(value) : value
    if (forceFixed || roundingEnabled) return next.toFixed(2)
    return String(value)
  }

  const rows = useMemo<ResultRow[]>(() => {
    if (noCompetitorData) return []
    if (!adjusters || adjusters.length === 0) return []

    const arrays: FilterValue[][] = []
    const humanKeys: string[] = []
    const columnNames: string[] = []
    const FILTER_KEY_TO_COLUMN: Record<string, string> = {
      competitors: 'competitor_name',
      locations: 'modstorage_location',
      dimensions: 'unit_dimensions',
      unit_categories: 'unit_category',
    }

    // Separate filters into combinatoric filters (contribute to cartesian product)
    // and non-combinatoric filters (used to pre-filter the competitorData input).
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

    // Helper to apply non-combinatoric subset filters to a dataset
    const applyPreFilters = (inputRows: E1DataRow[]): E1DataRow[] => {
      if (preFilters.length === 0) return inputRows
      let pool = inputRows
      for (const pf of preFilters) {
        const set = new Set(pf.values.map(String))
        pool = pool.filter((row) => {
          const val = (row as Record<string, unknown>)[pf.column]
          if (val === null || val === undefined) return false
          return set.has(String(val))
        })
      }
      return pool
    }
    
    // Build arrays and metadata from combinatoric filters
    for (const c of combinatoric) {
      arrays.push(c.values)
      // Display headers as the actual data columns.
      // For built-in keys (competitors/locations/...), this avoids showing the human alias.
      humanKeys.push(c.column)
      columnNames.push(c.column)
    }

    // Case 1: no combinatoric filters selected → single aggregate row
    if (arrays.length === 0) {
      const pool = applyPreFilters(competitorData)
      
      let price: number | null = null
      try {
        const result = calculatePrice({
          competitorData: pool,
          clientUnit: { available_units: clientAvailableUnits },
          adjusters,
          currentDate
        })
        if (result && typeof result.price === 'number' && !Number.isNaN(result.price)) {
          price = result.price
        }
      } catch (e) {
        console.error('[CalculatedPrice] Error for aggregate dataset (no combinatoric filters):', e)
      }

      if (price === null) return []

      return [{ comboMap: {}, price }]
    }

    // Case 2: at least one combinatoric filter → Cartesian combinations
    const combinations = cartesianProduct<FilterValue>(arrays)

    return combinations
      .map((combo): ResultRow => {
      // Apply pre-filters (non-combinatoric) first to the competitor data
      let pool = competitorData
      pool = applyPreFilters(pool)

      const subset = pool.filter((row) =>
        columnNames.every((col, i) => String((row as Record<string, unknown>)[col]) === String(combo[i]))
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
          currentDate
        })
        if (result && typeof result.price === 'number' && !Number.isNaN(result.price)) {
          price = result.price
        }
      } catch (e) {
        console.error('[CalculatedPrice] Error for combo:', combo, e)
      }

      return { comboMap, price }
    })
      .filter((r) => r.price !== null) // skip invalid rows
  }, [noCompetitorData, competitorData, clientAvailableUnits, adjusters, currentDate, filters, combinatoricFlags])

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

  const headers = [...new Set(rows.flatMap((r) => Object.keys(r.comboMap))), 'Price']

  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
      <table className="w-full table-auto border border-gray-200">
        <thead className="bg-gray-100 sticky top-0 z-10">
          <tr>
            {headers.map((h) => (
              <th key={h} className="border px-3 py-2 text-left text-sm font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="even:bg-gray-50">
              {headers.map((h) =>
                h === 'Price' ? (
                  <td key={h} className="border px-3 py-2 font-bold">
                    {`$${formatNumeric(r.price!, true)}`}
                  </td>
                ) : (
                  <td key={h} className="border px-3 py-2">
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