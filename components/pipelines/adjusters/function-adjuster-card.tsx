import { Calculator } from 'lucide-react'
import type { FunctionBasedAdjuster } from '@/lib/adjusters'
import { AdjusterCardShell } from './adjuster-card-shell'

interface FunctionAdjusterCardProps {
  adjuster: FunctionBasedAdjuster
  stepNumber: number
  totalSteps: number
  onRemove?: () => void
}

export function FunctionAdjusterCard({ adjuster, stepNumber, totalSteps, onRemove }: FunctionAdjusterCardProps) {
  return (
    <AdjusterCardShell
      stepNumber={stepNumber}
      totalSteps={totalSteps}
      accentColor="#d97706"
      className="border-amber-100/80 bg-white"
      onRemove={onRemove}
      badge={
        <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100/80 px-3 py-1 text-xs font-semibold text-amber-800">
          <Calculator className="h-4 w-4" />
          Function
        </div>
      }
    >
      <div className="rounded-2xl border border-amber-100/70 bg-amber-50/60 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Function</p>
        <code className="block font-mono text-sm text-amber-900 break-words">
          {adjuster.function_string}
        </code>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Variable</dt>
          <dd className="mt-1 inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-0.5 font-mono text-xs">
            {adjuster.variable}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Domain</dt>
          <dd className="mt-1 font-mono">
            [{adjuster.domain_min}, {adjuster.domain_max}]
          </dd>
        </div>
      </dl>
    </AdjusterCardShell>
  )
}
