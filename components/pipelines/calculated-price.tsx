import { useMemo } from 'react'
import { calculatePrice } from '@/lib/adjusters'
import type { Adjuster } from '@/lib/adjusters'
import type { E1DataRow } from '@/lib/api/types'
import { Card } from '@/components/ui/card'
import { AlertCircle, AlertTriangle, Calculator } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CalculatedPriceProps {
  competitorData: E1DataRow[]
  clientAvailableUnits: number
  adjusters: Adjuster[]
  currentDate: Date
  variant?: 'panel' | 'inline'
}

export function CalculatedPrice({
  competitorData,
  clientAvailableUnits,
  adjusters,
  currentDate,
  variant = 'panel'
}: CalculatedPriceProps) {
  const isInline = variant === 'inline'

  const result = useMemo(() => {
    if (!adjusters || adjusters.length === 0) {
      return null
    }

    try {
      return calculatePrice({
        competitorData,
        clientUnit: { available_units: clientAvailableUnits },
        adjusters,
        currentDate,
      })
    } catch (error) {
      console.error('[CalculatedPrice] Error calculating price:', error)
      return null
    }
  }, [competitorData, clientAvailableUnits, adjusters, currentDate])

  const calculatedPrice = result?.price ?? null
  const warnings = result?.warnings ?? []

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

  if (calculatedPrice === null) {
    return (
      <Card className={cn('p-6 bg-destructive/10 border-destructive/20', isInline && 'h-full rounded-2xl')}>
        <div className="flex items-center gap-3 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <div>
            <div className="font-medium">Calculation failed</div>
            <div className="text-sm">
              Unable to calculate price with current adjusters. Check console for details.
            </div>
          </div>
        </div>
      </Card>
    )
  }

  const dateDisplay = currentDate.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })

  return (
    <Card
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
                Calculated Price
              </div>
              <div className={cn('text-3xl font-bold text-primary', isInline && 'text-4xl')}>
                ${calculatedPrice.toFixed(2)}
              </div>
            </div>
          </div>
          <div className={cn('text-right text-xs text-muted-foreground space-y-1', isInline && 'text-left xl:text-right')}>
            <div className="font-medium text-foreground">{dateDisplay}</div>
            <div>{adjusters.length} adjuster{adjusters.length !== 1 ? 's' : ''} applied</div>
            <div>{competitorData.length} competitor unit{competitorData.length !== 1 ? 's' : ''}</div>
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
}
