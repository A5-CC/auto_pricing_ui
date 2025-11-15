import type { ReactNode } from 'react'
import type { Adjuster } from '@/lib/adjusters'
import { cn } from '@/lib/utils'
import { CompetitiveAdjusterCard } from './adjusters/competitive-adjuster-card'
import { FunctionAdjusterCard } from './adjusters/function-adjuster-card'
import { TemporalAdjusterCard } from './adjusters/temporal-adjuster-card'

interface AdjustersListProps {
  adjusters: Adjuster[]
  actions?: ReactNode
  resultCard?: ReactNode
  onRemoveAdjuster?: (index: number) => void
}

export function AdjustersList({ adjusters, actions, resultCard, onRemoveAdjuster }: AdjustersListProps) {
  const list = adjusters ?? []
  const totalSteps = list.length
  const desktopColumns = 3
  const remainder = totalSteps % desktopColumns
  const spacesLeft = remainder === 0 ? desktopColumns : desktopColumns - remainder

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Adjusters ({totalSteps})</p>
          <p className="text-xs text-muted-foreground">
            Steps run sequentially; later adjusters build on the output of earlier ones.
          </p>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {totalSteps === 0 ? (
        <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <li className="sm:col-span-2 xl:col-span-3">
            <div className="rounded-2xl border border-dashed border-muted-foreground/30 bg-muted/10 py-10 text-center text-sm text-muted-foreground">
              No adjusters configured. Add an adjuster to start calculating prices.
            </div>
          </li>
          {resultCard && (
            <li className="h-full sm:col-span-2 xl:col-span-3">{resultCard}</li>
          )}
        </ol>
      ) : (
        <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((adjuster, index) => {
            const stepNumber = index + 1
            const key = `${adjuster.type}-${stepNumber}`
            const card =
              adjuster.type === 'competitive' ? (
                <CompetitiveAdjusterCard
                  adjuster={adjuster}
                  stepNumber={stepNumber}
                  totalSteps={totalSteps}
                  onRemove={onRemoveAdjuster ? () => onRemoveAdjuster(index) : undefined}
                />
              ) : adjuster.type === 'function' ? (
                <FunctionAdjusterCard
                  adjuster={adjuster}
                  stepNumber={stepNumber}
                  totalSteps={totalSteps}
                  onRemove={onRemoveAdjuster ? () => onRemoveAdjuster(index) : undefined}
                />
              ) : (
                <TemporalAdjusterCard
                  adjuster={adjuster}
                  stepNumber={stepNumber}
                  totalSteps={totalSteps}
                  onRemove={onRemoveAdjuster ? () => onRemoveAdjuster(index) : undefined}
                />
              )

            return (
              <li key={key} className="h-full">
                {card}
              </li>
            )
          })}
          {resultCard && (
            <li
              className={cn(
                'h-full sm:col-span-2',
                spacesLeft === 3 ? 'xl:col-span-3' : spacesLeft === 2 ? 'xl:col-span-2' : 'xl:col-span-1'
              )}
            >
              {resultCard}
            </li>
          )}
        </ol>
      )}
    </div>
  )
}
