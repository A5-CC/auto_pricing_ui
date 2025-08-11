"use client"

import { RunStatus } from "@/lib/api/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

function StatusBadge({ status }: { status: RunStatus["status"] }) {
  const variant =
    status === "completed" ? "default" : status === "running" ? "secondary" : status === "failed" ? "destructive" : "outline"
  return <Badge variant={variant}>{status}</Badge>
}

export function StatusHeader({
  latestStatus,
  isBusy,
  triggering,
  onTrigger,
}: {
  latestStatus: RunStatus | null
  isBusy: boolean
  triggering: boolean
  onTrigger: () => void
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline runs</h1>
        <p className="text-sm text-muted-foreground">Monitor the A1/A2 competitor pricing pipeline and trigger new runs.</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status</span>
          {latestStatus ? <StatusBadge status={latestStatus.status} /> : <Badge variant="outline">—</Badge>}
        </div>
        <Button onClick={onTrigger} disabled={triggering || isBusy}>
          {triggering ? "Queuing…" : isBusy ? "Running…" : "Run now"}
        </Button>
      </div>
    </header>
  )
}


