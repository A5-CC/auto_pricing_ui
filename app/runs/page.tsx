"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { getLatestRunStatus, getRunHistory, triggerPipelineRun } from "@/lib/api/client/runs"
import { ApiError } from "@/lib/api/client/shared"
import { RunStatus } from "@/lib/api/types"
import { StatusHeader } from "@/components/runs/status-header"
import { RunHistoryTable } from "@/components/runs/run-history-table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Info } from "lucide-react"
import { ContextChips } from "@/components/context-chips"
import { useContextChips } from "@/hooks/useContextChips"


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

function formatRunningValue(value: number | undefined, isRunning: boolean, fallback = "—") {
  if (isRunning && (value === 0 || value === undefined)) {
    return "Processing..."
  }
  return value?.toString() ?? fallback
}

function formatStatus(status?: string) {
  if (!status) return { text: "—", className: "" }

  switch (status) {
    case "running":
      return { text: "Running", className: "text-blue-600 font-medium" }
    case "completed":
      return { text: "Completed", className: "text-green-600 font-medium" }
    case "failed":
      return { text: "Failed", className: "text-red-600 font-medium" }
    case "idle":
      return { text: "Idle", className: "text-gray-500" }
    default:
      return { text: status, className: "" }
  }
}

export default function RunsPage() {
  const [latestStatus, setLatestStatus] = useState<RunStatus | null>(null)
  const [runHistory, setRunHistory] = useState<RunStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [triggering, setTriggering] = useState(false)
  const [currentTime, setCurrentTime] = useState(Date.now())
  const { createChips } = useContextChips()

  const isBusy = latestStatus?.status === "running"

  const failedCount = useMemo(() => latestStatus?.failed_count ?? 0, [latestStatus])

  // Real-time elapsed timer
  const elapsedTime = useMemo(() => {
    if (!isBusy || !latestStatus?.started_at) {
      return latestStatus?.duration_s
    }

    const startTime = new Date(latestStatus.started_at).getTime()
    return (currentTime - startTime) / 1000
  }, [isBusy, latestStatus?.started_at, latestStatus?.duration_s, currentTime])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      setInfo(null)
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

  // Timer for real-time elapsed time updates
  useEffect(() => {
    if (isBusy) {
      const timer = setInterval(() => {
        setCurrentTime(Date.now())
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [isBusy])

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

  const onTrigger = async (overwrite: boolean = false) => {
    setTriggering(true)
    setError(null)
    setInfo(null)
    try {
      await triggerPipelineRun(overwrite)
      const status = await getLatestRunStatus()
      setLatestStatus(status)
      setInfo("Scraping run queued successfully!")
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setInfo("Latest pricing data is already processed and available to view.")
        } else if (err.status >= 500) {
          setError("Server error occurred. Please try again later.")
        } else {
          setError("Unable to process request.")
        }
      } else {
        setError("Unable to connect to server")
      }
    } finally {
      setTriggering(false)
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <ContextChips
        chips={createChips(
          {
            label: "Scraping Runs",
            isCurrent: true
          }
        )}
      />
      <StatusHeader isBusy={isBusy} triggering={triggering} onTrigger={onTrigger} />

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {info && (
        <Alert className="bg-accent/10 border-l-4 border-blue-500/40 dark:border-blue-400/40 shadow-sm animate-in fade-in-0 zoom-in-95 duration-300">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-foreground">Information</AlertTitle>
          <AlertDescription>
            {info}
            {info.includes("already processed") && (
              <>
                {" "}
                <Link
                  href="/pricing"
                  className="text-primary hover:text-primary/80 underline underline-offset-4"
                >
                  View pricing data →
                </Link>
                <br />
                <span className="text-sm text-muted-foreground mt-1 block">
                  To reprocess the data, open Run options (caret next to Run) and choose &ldquo;Force reprocess&rdquo;.
                </span>
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          {isBusy ? "Ongoing run" : "Latest run"}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3 mb-4">
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground">Run ID</div>
            <div className="font-medium">{latestStatus?.run_id ?? "—"}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground">Started</div>
            <div className="font-medium">{formatDate(latestStatus?.started_at)}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground">{isBusy ? "Elapsed" : "Duration"}</div>
            <div className="font-medium">{secondsToHms(elapsedTime)}</div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground">Rows processed</div>
            <div className="font-medium">{formatRunningValue(latestStatus?.rows_processed, isBusy)}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground">Failed URLs</div>
            <div className="font-medium">{formatRunningValue(failedCount, isBusy, "0")}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground">Status</div>
            <div className={`font-medium ${formatStatus(latestStatus?.status).className}`}>
              {formatStatus(latestStatus?.status).text}
              {isBusy && (
                <span className="ml-2 inline-block h-2 w-2 rounded-full bg-blue-600 animate-pulse"></span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Past runs</h2>
        <RunHistoryTable runs={runHistory} loading={loading} />
      </section>
    </main>
  )
}


