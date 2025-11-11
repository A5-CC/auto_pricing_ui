import { Clock } from 'lucide-react'
import type { TemporalAdjuster } from '@/lib/adjusters'
import { AdjusterCardShell } from './adjuster-card-shell'

interface TemporalAdjusterCardProps {
  adjuster: TemporalAdjuster
  stepNumber: number
  totalSteps: number
  onRemove?: () => void
}

export function TemporalAdjusterCard({ adjuster, stepNumber, totalSteps, onRemove }: TemporalAdjusterCardProps) {
  const multipliers = adjuster.multipliers || []
  const isWeekly = adjuster.granularity === 'weekly'
  const labels = isWeekly
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const minMultiplier = multipliers.length ? Math.min(...multipliers) : 0
  const maxMultiplier = multipliers.length ? Math.max(...multipliers) : 0

  return (
    <AdjusterCardShell
      stepNumber={stepNumber}
      totalSteps={totalSteps}
      accentColor="#7c3aed"
      className="border-violet-100/80 bg-white"
      onRemove={onRemove}
      badge={
        <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-100/80 px-3 py-1 text-xs font-semibold text-violet-800">
          <Clock className="h-4 w-4" />
          Temporal
        </div>
      }
    >
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Granularity</dt>
          <dd className="mt-1 font-semibold capitalize">{adjuster.granularity}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Range</dt>
          <dd className="mt-1 font-mono">
            {minMultiplier.toFixed(2)} → {maxMultiplier.toFixed(2)}
          </dd>
        </div>
      </dl>

      <div className="rounded-2xl border border-violet-100/70 bg-violet-50/60 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">
          {isWeekly ? 'Weekly cadence' : 'Monthly cadence'}
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-4">
          {labels.map((label, idx) => (
            <div key={label} className="rounded-xl bg-white/90 px-2 py-1.5 shadow-sm">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
              <span className="mt-0.5 block font-mono text-sm text-foreground">
                {multipliers[idx] !== undefined ? multipliers[idx].toFixed(2) : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </AdjusterCardShell>
  )
}
