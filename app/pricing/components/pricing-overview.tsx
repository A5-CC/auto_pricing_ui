import type { PricingSnapshot, PricingDataResponse, ColumnStatistics, E1DataResponse } from "@/lib/api/types"
import { SectionLabel } from "@/components/ui/section-label"
import { TypeCountBadge } from "@/components/pricing/type-count-badge"
import { formatSnapshotDate } from "@/lib/pricing/formatters"
import { getTypeCounts } from "@/lib/pricing/stats"

interface PricingOverviewProps {
  selectedSnapshot: string
  snapshots: PricingSnapshot[]
  dataResponse: PricingDataResponse | E1DataResponse | null
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
  // Prefer the lightweight snapshot-list entry (already fetched on mount,
  // independent of the row-level data fetch) so Rows/Facilities/Columns
  // render instantly instead of waiting on the heavy data payload.
  const snapshotMeta = snapshots.find((s) => s.date === selectedSnapshot)
  const totalRows = snapshotMeta?.rows ?? dataResponse?.total_rows
  const totalFacilities = snapshotMeta?.facilities ?? dataResponse?.total_facilities
  const totalColumns = snapshotMeta?.columns ?? dataResponse?.columns?.length

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
              {snapshots.filter((s) => s.date !== "latest").map((s) => (
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
            {selectedSnapshot === "latest" && !dataResponse
              ? "Latest"
              : formatSnapshotDate(selectedSnapshot, dataResponse?.snapshot_date)}
          </div>
          <div className="hidden sm:block h-4 w-px bg-border" />
          <div className="text-muted-foreground">Rows</div>
          <div className="font-medium tabular-nums">{totalRows !== undefined ? totalRows.toLocaleString() : "—"}</div>
          <div className="hidden sm:block h-4 w-px bg-border" />
          <div className="text-muted-foreground">Facilities</div>
          <div className="font-medium tabular-nums">{totalFacilities !== undefined ? totalFacilities.toLocaleString() : "—"}</div>
          <div className="hidden sm:block h-4 w-px bg-border" />
          <div className="text-muted-foreground">Columns</div>
          <div className="font-medium tabular-nums">{totalColumns ?? "—"}</div>
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
