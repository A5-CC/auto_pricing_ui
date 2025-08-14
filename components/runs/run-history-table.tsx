"use client"

import { RunStatus } from "@/lib/api/types"
import { Badge } from "@/components/ui/badge"

function StatusBadge({ status }: { status: RunStatus["status"] }) {
  const variant =
    status === "completed" ? "default" : status === "running" ? "secondary" : status === "failed" ? "destructive" : "outline"
  return <Badge variant={variant}>{status}</Badge>
}

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

export function RunHistoryTable({
  runs,
  loading,
}: {
  runs: RunStatus[]
  loading: boolean
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left">
          <tr>
            <th className="px-4 py-2">Run ID</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Started</th>
            <th className="px-4 py-2">Duration</th>
            <th className="px-4 py-2">Rows</th>
            <th className="px-4 py-2">Failed</th>
          </tr>
        </thead>
        <tbody>
          {(loading ? Array.from({ length: 5 }).map((_, i) => (
            <tr key={`skeleton-${i}`} className="border-t">
              <td className="px-4 py-2"><div className="h-4 w-40 animate-pulse rounded bg-muted" /></td>
              <td className="px-4 py-2"><div className="h-4 w-20 animate-pulse rounded bg-muted" /></td>
              <td className="px-4 py-2"><div className="h-4 w-32 animate-pulse rounded bg-muted" /></td>
              <td className="px-4 py-2"><div className="h-4 w-20 animate-pulse rounded bg-muted" /></td>
              <td className="px-4 py-2"><div className="h-4 w-16 animate-pulse rounded bg-muted" /></td>
              <td className="px-4 py-2"><div className="h-4 w-12 animate-pulse rounded bg-muted" /></td>
            </tr>
          )) : runs.length ? (
            runs.map((run) => (
              <tr key={run.run_id} className="border-t">
                <td className="px-4 py-2 font-mono">{run.run_id}</td>
                <td className="px-4 py-2"><StatusBadge status={run.status} /></td>
                <td className="px-4 py-2">{formatDate(run.started_at)}</td>
                <td className="px-4 py-2">{secondsToHms(run.duration_s)}</td>
                <td className="px-4 py-2">{run.rows_processed ?? "—"}</td>
                <td className="px-4 py-2">{run.failed_count ?? 0}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-4 py-6 text-center text-muted-foreground" colSpan={6}>No runs yet</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}


