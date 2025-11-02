import type { PricingSnapshot, PricingDataResponse, ColumnStatistics } from "@/lib/api/types"
import { SectionLabel } from "@/components/ui/section-label"
import { TypeCountBadge } from "@/components/pricing/type-count-badge"
import { formatSnapshotDate } from "@/lib/pricing/formatters"
import { getTypeCounts } from "@/lib/pricing/stats"

interface PricingOverviewProps {
  selectedSnapshot: string
  snapshots: PricingSnapshot[]
  dataResponse: PricingDataResponse | null
  columnsStats: Record<string, ColumnStatistics>
  onSnapshotChange: (snapshot: string) => void
}

/**
 * Overview section displaying snapshot selector and key statistics
 * Shows snapshot date, row count, facilities, columns, and type distribution
 */
export function PricingOverview({
  selectedSnapshot,
  snapshots,
  dataResponse,
  columnsStats,
  onSnapshotChange,
}: PricingOverviewProps) {
  return (
    <>
      <SectionLabel
        text="Overview"
        right={(
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="hidden sm:inline">Snapshot</span>
            <select
              className="rounded-md border px-2 py-1 text-sm outline-none focus-visible:border-ring"
              value={selectedSnapshot}
              onChange={(e) => onSnapshotChange(e.target.value)}
              aria-label="Select snapshot"
            >
              <option value="latest">Latest</option>
              {snapshots.map((s) => (
                <option key={s.date} value={s.date}>{s.date}</option>
              ))}
            </select>
          </div>
        )}
      />
      <section className="rounded-lg border bg-background/50 p-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <div className="text-muted-foreground">Snapshot</div>
          <div className="font-medium">
            {formatSnapshotDate(selectedSnapshot, dataResponse?.snapshot_date)}
          </div>
          <div className="hidden sm:block h-4 w-px bg-border" />
          <div className="text-muted-foreground">Rows</div>
          <div className="font-medium tabular-nums">{dataResponse ? dataResponse.total_rows.toLocaleString() : "—"}</div>
          <div className="hidden sm:block h-4 w-px bg-border" />
          <div className="text-muted-foreground">Facilities</div>
          <div className="font-medium tabular-nums">{dataResponse ? dataResponse.total_facilities.toLocaleString() : "—"}</div>
          <div className="hidden sm:block h-4 w-px bg-border" />
          <div className="text-muted-foreground">Columns</div>
          <div className="font-medium tabular-nums">{dataResponse?.columns?.length ?? "—"}</div>
          {!!Object.keys(columnsStats).length && (
            <div className="hidden md:flex items-center gap-1">
              {getTypeCounts(columnsStats).slice(0, 4).map(([type, count]) => (
                <TypeCountBadge key={type} type={type} count={count} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
