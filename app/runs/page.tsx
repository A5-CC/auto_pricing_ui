"use client"

import { useEffect, useMemo, useState } from "react"
import { getLatestRunStatus, getRunHistory, triggerPipelineRun } from "@/lib/api/client"
import { RunStatus } from "@/lib/api/types"
import { StatusHeader } from "@/components/runs/status-header"
import { RunHistoryTable } from "@/components/runs/run-history-table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"


function formatDate(value?: string) {
  if (!value) return "—"
  try {
    const date = new Date(value)
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date)
  } catch {
    return value
  }
}

function secondsToHms(seconds?: number) {
  if (!seconds && seconds !== 0) return "—"
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return [
    d ? `${d}d` : null,
    h ? `${h}h` : null,
    m ? `${m}m` : null,
    s || (!d && !h && !m) ? `${s}s` : null,
  ]
    .filter(Boolean)
    .join(" ")
}

export default function RunsPage() {
  const [latestStatus, setLatestStatus] = useState<RunStatus | null>(null)
  const [runHistory, setRunHistory] = useState<RunStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [triggering, setTriggering] = useState(false)

  const isBusy = latestStatus?.status === "running"

  const failedCount = useMemo(() => latestStatus?.failed_urls?.length ?? 0, [latestStatus])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [status, history] = await Promise.all([
          getLatestRunStatus(),
          getRunHistory(),
        ])
        setLatestStatus(status)
        setRunHistory(history.runs)
      } catch {
        setError("Unable to connect to server")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (latestStatus?.status === "running") {
      const interval = setInterval(async () => {
        try {
          const status = await getLatestRunStatus()
          setLatestStatus(status)
          if (status.status !== "running") {
            const history = await getRunHistory()
            setRunHistory(history.runs)
          }
        } catch {
          // swallow errors during polling
        }
      }, 30000)
      return () => clearInterval(interval)
    }
  }, [latestStatus?.status])

  const onTrigger = async () => {
    setTriggering(true)
    setError(null)
    try {
      await triggerPipelineRun(false)
      const status = await getLatestRunStatus()
      setLatestStatus(status)
    } catch {
      setError("Unable to connect to server")
    } finally {
      setTriggering(false)
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <StatusHeader latestStatus={latestStatus} isBusy={isBusy} triggering={triggering} onTrigger={onTrigger} />

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Connection error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="text-xs text-muted-foreground">Run ID</div>
          <div className="font-medium">{latestStatus?.run_id ?? "—"}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-muted-foreground">Started</div>
          <div className="font-medium">{formatDate(latestStatus?.started_at)}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-muted-foreground">Duration</div>
          <div className="font-medium">{secondsToHms(latestStatus?.duration_s)}</div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="text-xs text-muted-foreground">Rows processed</div>
          <div className="font-medium">{latestStatus?.rows_processed ?? "—"}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-muted-foreground">Failed URLs</div>
          <div className="font-medium">{failedCount}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-muted-foreground">Finished</div>
          <div className="font-medium">{formatDate(latestStatus?.finished_at)}</div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent runs</h2>
        <RunHistoryTable runs={runHistory} loading={loading} />
      </section>
    </main>
  )
}


