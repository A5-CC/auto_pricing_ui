"use client"

import { useEffect, useMemo, useState } from "react"
import { getURLDumps, getURLDumpDetail, getLatestURLDump } from "@/lib/api/client"
import type { URLDumpDetail, URLDumpSummary } from "@/lib/api/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
}

function formatTimestamp(ts: string): string {
  const match = ts.match(/(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})/)
  if (!match) return ts
  const [, y, m, d, hh, mm] = match
  const date = new Date(`${y}-${m}-${d}T${hh}:${mm}:00Z`)
  return date.toLocaleString()
}

export default function URLDumpsPage() {
  const [dumps, setDumps] = useState<URLDumpSummary[]>([])
  const [selectedDump, setSelectedDump] = useState<URLDumpDetail | null>(null)
  const [latestDump, setLatestDump] = useState<URLDumpDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    loadDumps()
  }, [])

  const loadDumps = async () => {
    try {
      setLoading(true)
      setError(null)
      const [dumpsList, latest] = await Promise.all([
        getURLDumps(),
        getLatestURLDump(),
      ])
      setDumps(dumpsList)
      setLatestDump(latest)
    } catch {
      setError("Failed to load URL dumps")
    } finally {
      setLoading(false)
    }
  }

  const handleViewDump = async (timestamp: string) => {
    try {
      setDetailLoading(true)
      const detail = await getURLDumpDetail(timestamp)
      setSelectedDump(detail)
    } catch {
      // ignore
    } finally {
      setDetailLoading(false)
    }
  }

  const filteredUrls = useMemo(() => {
    if (!selectedDump) return [] as URLDumpDetail["urls"]
    const q = searchTerm.trim().toLowerCase()
    if (!q) return selectedDump.urls
    return selectedDump.urls.filter((u) =>
      u.modstorage_location.toLowerCase().includes(q) ||
      u.competitor_name.toLowerCase().includes(q) ||
      u.competitor_address.toLowerCase().includes(q)
    )
  }, [selectedDump, searchTerm])

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">URL Dumps</h1>
        <p className="text-sm text-muted-foreground">Explore discovered competitor URLs that feed the pricing pipeline.</p>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="text-xs text-muted-foreground">Latest dump</div>
          <div className="font-medium">{latestDump ? latestDump.timestamp : "—"}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-muted-foreground">URLs in latest</div>
          <div className="font-medium">{latestDump ? latestDump.total_urls : "—"}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-muted-foreground">Created</div>
          <div className="font-medium">{latestDump ? new Date(latestDump.created_at).toLocaleString() : "—"}</div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Available dumps</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-2">ID</th>
                <th className="px-4 py-2">Timestamp</th>
                <th className="px-4 py-2">Total URLs</th>
                <th className="px-4 py-2">File Size</th>
                <th className="px-4 py-2">Created At</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(loading ? Array.from({ length: 6 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="border-t">
                  <td className="px-4 py-2"><div className="h-4 w-32 animate-pulse rounded bg-muted" /></td>
                  <td className="px-4 py-2"><div className="h-4 w-40 animate-pulse rounded bg-muted" /></td>
                  <td className="px-4 py-2"><div className="h-4 w-20 animate-pulse rounded bg-muted" /></td>
                  <td className="px-4 py-2"><div className="h-4 w-24 animate-pulse rounded bg-muted" /></td>
                  <td className="px-4 py-2"><div className="h-4 w-40 animate-pulse rounded bg-muted" /></td>
                  <td className="px-4 py-2"><div className="h-8 w-20 animate-pulse rounded bg-muted" /></td>
                </tr>
              )) : dumps.length ? (
                dumps
                  .slice()
                  .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
                  .map((d, index) => (
                    <tr key={d.timestamp} className="border-t">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{d.timestamp}</span>
                          {index === 0 && (
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                              Latest
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 font-mono">{formatTimestamp(d.timestamp)}</td>
                      <td className="px-4 py-2">{d.total_urls}</td>
                      <td className="px-4 py-2">{formatBytes(d.size_bytes)}</td>
                      <td className="px-4 py-2">{new Date(d.created_at).toLocaleString()}</td>
                      <td className="px-4 py-2">
                        <Button size="sm" onClick={() => handleViewDump(d.timestamp)} disabled={detailLoading}>
                          {detailLoading ? "Loading…" : "View"}
                        </Button>
                      </td>
                    </tr>
                  ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-center text-muted-foreground" colSpan={6}>No dumps available</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedDump && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Dump {selectedDump.timestamp}</h3>
              <p className="text-sm text-muted-foreground">{selectedDump.total_urls} URLs • Created {new Date(selectedDump.created_at).toLocaleString()}</p>
            </div>
            <Button variant="outline" onClick={() => setSelectedDump(null)}>Close</Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <div className="text-xs text-muted-foreground">By location</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                {Object.entries(selectedDump.locations_summary).map(([loc, count]) => (
                  <div key={loc} className="flex justify-between">
                    <span className="truncate pr-2" title={loc}>{loc}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs text-muted-foreground">By competitor</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                {Object.entries(selectedDump.competitors_summary).map(([comp, count]) => (
                  <div key={comp} className="flex justify-between">
                    <span className="truncate pr-2" title={comp}>{comp}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-medium">URLs</h4>
              <input
                className="w-64 rounded-md border px-3 py-2 text-sm outline-none focus-visible:border-ring"
                placeholder="Search location, competitor, address"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-4 py-2">Location</th>
                    <th className="px-4 py-2">Competitor</th>
                    <th className="px-4 py-2">Address</th>
                    <th className="px-4 py-2">Confidence</th>
                    <th className="px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUrls.map((u, idx) => (
                    <tr key={`${u.modstorage_location}-${idx}`} className="border-t">
                      <td className="px-4 py-2 whitespace-nowrap">{u.modstorage_location}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{u.competitor_name}</td>
                      <td className="px-4 py-2 min-w-64">{u.competitor_address}</td>
                      <td className="px-4 py-2">{u.confidence}%</td>
                      <td className="px-4 py-2">
                        <div className="flex gap-2">
                          <a className="text-primary underline" href={u.maps_url} target="_blank" rel="noopener noreferrer">Maps</a>
                          <a className="text-primary underline" href={u.final_pricing_url} target="_blank" rel="noopener noreferrer">Pricing</a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </main>
  )
}


