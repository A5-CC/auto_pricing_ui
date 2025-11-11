import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AdjusterCardShellProps {
  stepNumber: number
  totalSteps: number
  accentColor: string
  badge: ReactNode
  children: ReactNode
  className?: string
  onRemove?: () => void
}

export function AdjusterCardShell({
  stepNumber,
  totalSteps,
  accentColor,
  badge,
  children,
  className,
  onRemove
}: AdjusterCardShellProps) {
  return (
    <div
      className={cn(
        'relative flex h-full flex-col gap-5 overflow-hidden rounded-2xl border bg-white/95 p-5 text-sm shadow-sm ring-1 ring-black/[0.03]',
        className
      )}
    >
      <div className="relative flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Step {stepNumber} of {totalSteps}
          </p>
          <ProgressDots accentColor={accentColor} activeIndex={stepNumber - 1} total={totalSteps} />
        </div>
        {(badge || onRemove) && (
          <div className="flex items-center gap-2">
            {badge}
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="rounded-full border border-transparent p-1 text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:bg-muted/20 hover:text-foreground"
                aria-label="Remove adjuster"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="relative flex flex-1 flex-col gap-4 text-sm text-foreground">{children}</div>
    </div>
  )
}

interface ProgressDotsProps {
  total: number
  activeIndex: number
  accentColor: string
}

function ProgressDots({ total, activeIndex, accentColor }: ProgressDotsProps) {
  if (total === 1) return null

  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, idx) => {
        const isActive = idx <= activeIndex
        const width = idx === activeIndex ? 18 : 12
        return (
          <span
            key={idx}
            className="h-1.5 rounded-full transition-all"
            style={{
              width,
              backgroundColor: isActive ? accentColor : 'rgba(148, 163, 184, 0.55)'
            }}
          />
        )
      })}
    </div>
  )
}
