import type { CompetitivePriceAdjuster } from '@/lib/adjusters'
import { TrendingDown } from 'lucide-react'
import { AdjusterCardShell } from './adjuster-card-shell'

interface CompetitiveAdjusterCardProps {
  adjuster: CompetitivePriceAdjuster
  stepNumber: number
  totalSteps: number
  onRemove?: () => void
  showVariable?: boolean
}

export function CompetitiveAdjusterCard({ adjuster, stepNumber, totalSteps, onRemove, showVariable = false }: CompetitiveAdjusterCardProps) {
  const multiplier = typeof adjuster.multiplier === 'number' && isFinite(adjuster.multiplier) ? adjuster.multiplier : 1;
  const offset = typeof adjuster.offset === 'number' && isFinite(adjuster.offset)
    ? adjuster.offset
    : (typeof adjuster.add === 'number' && isFinite(adjuster.add) ? adjuster.add : 0)
      - (typeof adjuster.subtract === 'number' && isFinite(adjuster.subtract) ? adjuster.subtract : 0);
  const sourceColumn = Array.isArray(adjuster.price_columns) && adjuster.price_columns.length > 0
    ? adjuster.price_columns[0]
    : '—';
  const variableSelection = Array.isArray(adjuster.price_columns) && adjuster.price_columns.length > 0
    ? adjuster.price_columns.join(', ')
    : '—';

  return (
    <AdjusterCardShell
      stepNumber={totalSteps > 1 ? stepNumber : undefined}
      totalSteps={totalSteps > 1 ? totalSteps : undefined}
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
          <dt className="text-muted-foreground">Source column</dt>
          <dd className="font-mono text-xs sm:text-sm break-all text-right">{sourceColumn}</dd>
        </div>
        {showVariable ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Variable</dt>
            <dd className="font-mono text-xs sm:text-sm break-all text-right">{variableSelection}</dd>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Aggregation</dt>
          <dd className="font-semibold capitalize">{adjuster.aggregation}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Multiplier</dt>
          <dd className="font-mono text-base">× {multiplier}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Offset</dt>
          <dd className="font-mono text-base">{offset >= 0 ? `+ $${offset}` : `- $${Math.abs(offset)}`}</dd>
        </div>
      </dl>
    </AdjusterCardShell>
  );
}
