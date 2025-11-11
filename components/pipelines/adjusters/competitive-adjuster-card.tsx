import { TrendingDown } from 'lucide-react'
import type { CompetitivePriceAdjuster } from '@/lib/adjusters'
import { AdjusterCardShell } from './adjuster-card-shell'

interface CompetitiveAdjusterCardProps {
  adjuster: CompetitivePriceAdjuster
  stepNumber: number
  totalSteps: number
  onRemove?: () => void
}

export function CompetitiveAdjusterCard({ adjuster, stepNumber, totalSteps, onRemove }: CompetitiveAdjusterCardProps) {
  const multiplierDisplay = Number(adjuster.multiplier).toFixed(2)

  return (
    <AdjusterCardShell
      stepNumber={stepNumber}
      totalSteps={totalSteps}
      accentColor="#2563eb"
      className="border-blue-100/80 bg-white"
      onRemove={onRemove}
      badge={
        <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-100/80 px-3 py-1 text-xs font-semibold text-blue-700">
          <TrendingDown className="h-4 w-4" />
          Competitive
        </div>
      }
    >
      <dl className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Aggregation</dt>
          <dd className="font-semibold capitalize">{adjuster.aggregation}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Multiplier</dt>
          <dd className="font-mono text-base">× {multiplierDisplay}</dd>
        </div>
      </dl>

    </AdjusterCardShell>
  )
}
