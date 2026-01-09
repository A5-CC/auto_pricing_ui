import React, { useMemo } from 'react'
import { calculatePrice } from '@/lib/adjusters'
import type { Adjuster } from '@/lib/adjusters'
import type { E1DataRow } from '@/lib/api/types'

type FilterValue = string | number | boolean

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
}

export function CalculatedPrice({
  competitorData,
  clientAvailableUnits,
  adjusters,
  currentDate,
  filters = {},
  maxCombinations = 50
  , combinatoricFlags = {}
}: CalculatedPriceProps) {

  const rows = useMemo(() => {
    if (!adjusters || adjusters.length === 0) return []

    const arrays: FilterValue[][] = []
    const humanKeys: string[] = []
    const columnNames: string[] = []
    const FILTER_KEY_TO_COLUMN: Record<string, string> = {
      competitors: 'competitor_name',
      locations: 'location_normalized',
      dimensions: 'dimensions_normalized',
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


    // Build arrays and metadata from combinatoric filters
    for (const c of combinatoric) {
      arrays.push(c.values)
      humanKeys.push(c.key)
      columnNames.push(c.column)
    }

    if (arrays.length === 0) return []

    const combinations = cartesianProduct<FilterValue>(arrays)

    return combinations.map((combo) => {
      // Apply pre-filters (non-combinatoric) first to the competitor data
      let pool = competitorData
      for (const pf of preFilters) {
        const set = new Set(pf.values.map(String))
        pool = pool.filter((row) => {
          const val = (row as Record<string, unknown>)[pf.column]
          if (val === null || val === undefined) return false
          return set.has(String(val))
        })
      }

      const subset = pool.filter((row) =>
        columnNames.every((col, i) => String((row as Record<string, unknown>)[col]) === String(combo[i]))
      )

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

      return {
        comboMap: humanKeys.reduce<Record<string, FilterValue>>((acc, k, i) => {
          acc[k] = combo[i]
          return acc
        }, {}),
        price
      }
    }).filter(r => r.price !== null) // skip invalid rows
  }, [competitorData, clientAvailableUnits, adjusters, currentDate, filters, combinatoricFlags])

  if (!adjusters || adjusters.length === 0) {
    return <p className="text-muted-foreground">Add adjusters to calculate prices</p>
  }

  if (rows.length === 0) {
    return <p className="text-muted-foreground">No filter combinations selected or all prices invalid.</p>
  }

  const headers = [...new Set(rows.flatMap(r => Object.keys(r.comboMap))), 'Price']

  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
      <table className="w-full table-auto border border-gray-200">
        <thead className="bg-gray-100 sticky top-0 z-10">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="border px-3 py-2 text-left text-sm font-semibold"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="even:bg-gray-50">
              {headers.map((h) =>
                h === "Price" ? (
                  <td key={h} className="border px-3 py-2 font-bold">
                    {`$${r.price!.toFixed(2)}`}
                  </td>
                ) : (
                  <td key={h} className="border px-3 py-2">
                    {r.comboMap[h] ?? "-"}
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