"use client"

import { RunStatus } from "@/lib/api/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useState } from "react"

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
  onTrigger: (overwrite: boolean) => void
}) {
  const [overwrite, setOverwrite] = useState(false)
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline runs</h1>
        <p className="text-sm text-muted-foreground">Monitor the A1/A2 competitor pricing pipeline and trigger new runs.</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status</span>
          {latestStatus ? <StatusBadge status={latestStatus.status} /> : <Badge variant="outline">—</Badge>}
        </div>
        
        <div className="flex flex-col gap-2">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="force-reprocess"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              disabled={triggering || isBusy}
            />
            <Label htmlFor="force-reprocess" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Force reprocess existing data
            </Label>
          </div>
          
          {overwrite && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚠️ This will overwrite existing run data
            </p>
          )}
        </div>
        
        <Button onClick={() => onTrigger(overwrite)} disabled={triggering || isBusy} variant={overwrite ? "destructive" : "default"}>
          {triggering ? "Queuing…" : isBusy ? "Running…" : overwrite ? "Force run" : "Run now"}
        </Button>
      </div>
    </header>
  )
}


