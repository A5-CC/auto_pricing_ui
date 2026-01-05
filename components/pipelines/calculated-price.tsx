import React, { useMemo } from 'react'
import { calculatePrice } from '@/lib/adjusters'
import type { Adjuster } from '@/lib/adjusters'
import type { E1DataRow } from '@/lib/api/types'
import { Card } from '@/components/ui/card'
import { AlertCircle, AlertTriangle, Calculator } from 'lucide-react'
import { cn } from '@/lib/utils'

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

type PriceResult = {
  price: number
  warnings?: string[]
} | null

interface CalculatedPriceProps {
  competitorData: E1DataRow[]
  clientAvailableUnits: number
  adjusters: Adjuster[]
  currentDate: Date
  variant?: 'panel' | 'inline'
  filters?: Record<string, FilterSelection>
  availableFilterValues?: Record<string, FilterValue[]> 
  maxCombinations?: number
}

export function CalculatedPrice({
  competitorData,
  clientAvailableUnits,
  adjusters,
  currentDate,
  variant = 'panel',
  filters = {},
  availableFilterValues = {},
  maxCombinations = 50
}: CalculatedPriceProps) {
  const isInline = variant === 'inline'

  /**
   * Map logical filter keys used by the UI to actual column names in competitorData rows.
   * If your backend uses different names, update this mapping accordingly.
   */
  const FILTER_KEY_TO_COLUMN: Record<string, string> = {
    competitors: 'competitor_name',
    locations: 'location_normalized',
    dimensions: 'dimensions_normalized',
    unit_categories: 'unit_category',
  }

  const results = useMemo(() => {
    if (!adjusters || adjusters.length === 0) return []

    // Build arrays only from filters explicitly in "subset" mode with non-empty values.
    // Per your requirement: if no filter values are selected, show nothing and ask the user to pick.
    const arrays: FilterValue[][] = []
    const humanKeys: string[] = [] // original filter keys, e.g. "locations"
    const columnNames: string[] = [] // actual row column names, e.g. "location_normalized"

    for (const [key, filter] of Object.entries(filters)) {
      if (!filter) continue

      // Only accept explicit subset selections. We do NOT auto-expand "all" here.
      if (filter.mode === 'subset') {
        const vals = (filter as { mode: 'subset'; values: FilterValue[] }).values ?? []
        if (!vals || vals.length === 0) continue

        const col = FILTER_KEY_TO_COLUMN[key] ?? key // fallback to same key if mapping missing
        arrays.push(vals)
        humanKeys.push(key)
        columnNames.push(col)
      }
    }

    // If the user hasn't selected any filter subsets, do not calculate anything.
    if (arrays.length === 0) {
      return []
    }

    // Build combinations (cartesian product) in a stable order
    const combinations = cartesianProduct<FilterValue>(arrays)
    if (combinations.length > maxCombinations) {
      console.warn(
        `[CalculatedPrice] Too many combinations (${combinations.length}), trimming to ${maxCombinations}`
      )
      combinations.length = maxCombinations
    }

    return combinations.map((combo) => {
      // map human key -> value for labels
      const comboMap: Record<string, FilterValue> = {}
      humanKeys.forEach((k, i) => (comboMap[k] = combo[i]))

      // filter competitor rows by matching each columnName === combo value (string compare for safety)
      const subset = competitorData.filter((row) =>
        columnNames.every((col, i) => {
          const cell = (row as Record<string, unknown>)[col]
          // normalize to string for reliable comparison (also allows numeric filters)
          return String(cell) === String(combo[i])
        })
      )

      let result: PriceResult = null
      try {
        result = calculatePrice({
          competitorData: subset,
          clientUnit: { available_units: clientAvailableUnits },
          adjusters,
          currentDate
        }) as PriceResult

        if (!result || result.price == null) {
          result = {
            price: NaN,
            warnings:
              subset.length === 0
                ? [`No competitor rows for combination: ${humanKeys.map((k, i) => `${k}=${combo[i]}`).join(', ')}`]
                : [`calculatePrice returned null or invalid result`]
          }
        }
      } catch (error) {
        console.error('[CalculatedPrice] Error calculating price for combo:', comboMap, error)
        result = {
          price: NaN,
          warnings: [`Error calculating price: ${(error as Error)?.message ?? String(error)}`]
        }
      }

      return { combo, comboMap, humanKeys, columnNames, result }
    })
  }, [
    competitorData,
    clientAvailableUnits,
    adjusters,
    currentDate,
    filters,
    availableFilterValues,
    maxCombinations
  ])

  // no adjusters configured
  if (!adjusters || adjusters.length === 0) {
    return (
      <Card className={cn('p-6 bg-muted/30', isInline && 'h-full rounded-2xl border-dashed border-muted/40 bg-muted/10')}>
        <div className="flex items-center gap-3 text-muted-foreground">
          <Calculator className="h-5 w-5" />
          <div>
            <div className="font-medium">No price calculation</div>
            <div className="text-sm">Add adjusters to calculate a price</div>
          </div>
        </div>
      </Card>
    )
  }

  // user didn't select any filter values (per requirement: show nothing until they select filters)
  if (!results || results.length === 0) {
    return (
      <Card className={cn('p-6 bg-muted/10', isInline && 'h-full rounded-2xl')}>
        <div className="flex items-center gap-3 text-muted-foreground">
          <AlertCircle className="h-5 w-5" />
          <div>
            <div className="font-medium">No filters selected</div>
            <div className="text-sm">Select filter values to generate combinatorial pricing (e.g. location A and dimension 1).</div>
          </div>
        </div>
      </Card>
    )
  }

  // all combos produced but every result is invalid
  if (results.every(r => r.result == null || Number.isNaN(r.result.price))) {
    return (
      <Card className={cn('p-6 bg-destructive/10 border-destructive/20', isInline && 'h-full rounded-2xl')}>
        <div className="flex items-center gap-3 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <div>
            <div className="font-medium">Calculation failed</div>
            <div className="text-sm">
              Unable to calculate price with current adjusters and filter combinations. Check console for details.
            </div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {results.map(({ combo, humanKeys, result }, i) => {
        const calculatedPrice = result?.price
        const warnings = result?.warnings ?? []
        const dateDisplay = currentDate.toLocaleDateString('en-US', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
        const label = humanKeys.length > 0
          ? humanKeys.map((k, idx) => `${k}: ${String(combo[idx])}`).join(' · ')
          : combo.length > 0
            ? combo.join(' · ')
            : null

        return (
          <Card
            key={i}
            className={cn(
              'p-6 bg-primary/5 border-primary/20',
              isInline &&
                'h-full rounded-2xl border-primary/30 bg-white/95 shadow-sm ring-1 ring-black/[0.02]'
            )}
          >
            <div className="space-y-4">
              <div className={cn('flex items-center justify-between gap-4', isInline && 'flex-wrap xl:flex-nowrap')}>
                <div className="flex items-center gap-3">
                  <div className={cn('rounded-full bg-primary/10 p-2', isInline && 'bg-primary/15 text-primary')}>
                    <Calculator className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {label || 'Calculated Price'}
                    </div>
                    <div className={cn('text-3xl font-bold text-primary', isInline && 'text-4xl')}>
                      {typeof calculatedPrice === 'number' && !Number.isNaN(calculatedPrice)
                        ? `$${calculatedPrice.toFixed(2)}`
                        : '--'}
                    </div>
                  </div>
                </div>

                <div className={cn('text-right text-xs text-muted-foreground space-y-1', isInline && 'text-left xl:text-right')}>
                  <div className="font-medium text-foreground">{dateDisplay}</div>
                  <div>{adjusters.length} adjuster{adjusters.length !== 1 ? 's' : ''} applied</div>
                  <div>
                    {warnings.length > 0 && warnings[0].startsWith('No competitor rows') ? '0 competitor units' : ''}
                  </div>
                </div>
              </div>

              {warnings.length > 0 && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/30 border-l-2 border-amber-500/30">
                  <AlertTriangle className="h-4 w-4 text-amber-600/70 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {warnings[0]}
                    </p>
                    {warnings.length > 1 && (
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        +{warnings.length - 1} more warning{warnings.length - 1 > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
