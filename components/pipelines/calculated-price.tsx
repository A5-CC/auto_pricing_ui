import React from 'react'
import { useMemo } from 'react'
import { calculatePrice } from '@/lib/adjusters'
import type { Adjuster } from '@/lib/adjusters'
import type { E1DataRow } from '@/lib/api/types'
import { Card } from '@/components/ui/card'
import { AlertCircle, AlertTriangle, Calculator } from 'lucide-react'
import { cn } from '@/lib/utils'

// Concrete filter value types — expand if you need Date or objects
type FilterValue = string | number | boolean

// Cartesian product utility
function cartesianProduct<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>(
    (acc, curr) => acc.flatMap(a => curr.map(b => [...a, b])),
    [[]]
  )
}

// Filter selection type
type FilterSelection<T = FilterValue> =
  | { mode: 'all' }
  | { mode: 'subset'; values: T[] }

// Minimal expected structure for price results returned by calculatePrice
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
  availableFilterValues?: Record<string, FilterValue[]> // used when mode === 'all'
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

  const results = useMemo(() => {
    if (!adjusters || adjusters.length === 0) return []

    // Build arrays of values for each filter (typed), but:
    // - if filter.mode === 'all' -> use availableFilterValues[key] if present, else derive from competitorData
    // - if filter.mode === 'subset' with empty values -> skip (wildcard)
    const arrays: FilterValue[][] = []
    const keys: string[] = []

    for (const [key, filter] of Object.entries(filters)) {
      if (filter.mode === 'all') {
        let vals = availableFilterValues[key] ?? []
        if (!vals || vals.length === 0) {
          // derive unique values from competitorData for this key
          const derived = Array.from(
            new Set(
              competitorData
                .map((r: E1DataRow) => (r as any)[key])
                .filter((v) => v !== null && v !== undefined && v !== '')
            )
          )
          vals = derived as FilterValue[]
        }
        // if still empty, treat as wildcard (skip this filter)
        if (!vals || vals.length === 0) {
          continue
        }
        arrays.push(vals)
        keys.push(key)
      } else {
        // subset
        const vals = (filter as { mode: 'subset'; values: FilterValue[] }).values ?? []
        if (!vals || vals.length === 0) {
          // empty subset -> wildcard (skip)
          continue
        }
        arrays.push(vals)
        keys.push(key)
      }
    }

    // If no filter constraints (keys.length === 0), produce a single empty combo -> means "no filtering"
    const combinations = cartesianProduct<FilterValue>(arrays)

    // Cap to avoid UI explosion
    if (combinations.length > maxCombinations) {
      console.warn(
        `[CalculatedPrice] Too many combinations (${combinations.length}), trimming to ${maxCombinations}`
      )
      combinations.length = maxCombinations
    }

    // For each combination: filter competitorData to the subset matching the combo (by keys), then call calculatePrice
    return combinations.map((combo) => {
      // subset competitorData by matching combo (use keys)
      const subset = competitorData.filter((row: E1DataRow) =>
        // all keys must match; compare as strings for robustness
        keys.every((k, i) => {
          const rowVal = (row as any)[k]
          const comboVal = combo[i]
          // treat numeric/string equivalence by stringifying
          return String(rowVal) === String(comboVal)
        })
      )

      // create a helpful label/object for logging (only when needed)
      const comboLabel = keys.length
        ? keys.map((k, i) => `${k}=${String(combo[i])}`).join(', ')
        : combo.length > 0
          ? combo.join(' · ')
          : '(no filters)'

      // If the subset is empty, skip calling calculatePrice and return a NaN + warning result
      if (!subset || subset.length === 0) {
        console.debug(`[CalculatedPrice] Skipping calculatePrice for empty subset — combo: ${comboLabel}`)
        const warning = `No competitor rows for combination: ${comboLabel}`
        return { combo, keys, result: { price: NaN, warnings: [warning] } as PriceResult }
      }

      let result: PriceResult = null
      try {
        // call calculatePrice with the subset competitor data (do not pass unknown props)
        const maybe = calculatePrice({
          competitorData: subset,
          clientUnit: { available_units: clientAvailableUnits },
          adjusters,
          currentDate
        }) as unknown

        // Normalize return values: calculatePrice may return null or an object
        if (maybe == null) {
          console.error(`[CalculatedPrice] calculatePrice returned null for combo: ${comboLabel}`)
          result = { price: NaN, warnings: ['Calculation returned null'] }
        } else {
          result = maybe as PriceResult
          // If the adjuster logic returns an object without price, convert to NaN + warning
          if (result == null || (result && (result as any).price == null)) {
            result = { price: NaN, warnings: ['Calculation returned no price'] }
          }
        }
      } catch (error) {
        console.error('[CalculatedPrice] Error calculating price for combo:', comboLabel, error)
        result = {
          price: NaN,
          warnings: [`Error calculating price: ${(error as Error)?.message ?? String(error)}`]
        }
      }
      return { combo, keys, result }
    })
  // dependencies: competitorData so derived values update, adjusters, filters, etc.
  }, [
    competitorData,
    clientAvailableUnits,
    adjusters,
    currentDate,
    filters,
    availableFilterValues,
    maxCombinations
  ])

  // No adjusters
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

  // All calculations failed or no combos
  if (results.length === 0 || results.every(r => r.result == null || Number.isNaN(r.result.price))) {
    // show aggregated failure but keep console logs above for details
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
      {results.map(({ combo, keys, result }, i) => {
        const calculatedPrice = result?.price
        const warnings = result?.warnings ?? []
        const dateDisplay = currentDate.toLocaleDateString('en-US', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
        // label: "key1:val · key2:val" or fallback to join
        const label = keys && keys.length > 0
          ? keys.map((k, idx) => `${k}: ${String(combo[idx])}`).join(' · ')
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
                  <div>{ /* show number of competitor units used for this combo */ }
                    {
                      (() => {
                        try {
                          // If result came from subset, we don't have subset length attached — best effort:
                          // If calculatePrice returned warnings telling "No competitor rows...", show 0
                          if (warnings && warnings.length > 0 && warnings[0].startsWith('No competitor rows')) {
                            return '0 competitor units'
                          }
                        } catch {}
                        return ''
                      })()
                    }
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
