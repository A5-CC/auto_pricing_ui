"use client"

import { useEffect, useMemo, useState } from "react"
import { getRawScrapeDates, getRawScrapesForDate, getRawScrapeDetail } from "@/lib/api/client"
import type { RawScrapeDateSummary, RawScrapeDetail, RawScrapeSummary } from "@/lib/api/types"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Eye } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
}

function formatIsoDate(value?: string): string {
  if (!value) return "N/A"
  try {
    const date = new Date(value)
    if (isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date)
  } catch {
    return value
  }
}

export default function RawScrapesPage() {
  const [dates, setDates] = useState<RawScrapeDateSummary[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [scrapes, setScrapes] = useState<RawScrapeSummary[]>([])
  const [selectedScrape, setSelectedScrape] = useState<RawScrapeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [expanded, setExpanded] = useState(false)

  // Reset expanded state when switching scrapes
  useEffect(() => {
    setExpanded(false)
  }, [selectedScrape?.date, selectedScrape?.filename])

  const { wordCount, tokenEstimate } = useMemo(() => {
    if (!selectedScrape?.content) return { wordCount: 0, tokenEstimate: 0 }
    const words = selectedScrape.content.trim().split(/\s+/).filter(Boolean).length
    const tokens = Math.round((3 / 4) * words)
    return { wordCount: words, tokenEstimate: tokens }
  }, [selectedScrape?.content])

  useEffect(() => {
    loadDates()
  }, [])

  const loadDates = async () => {
    try {
      setLoading(true)
      const datesList = await getRawScrapeDates()
      setDates(datesList)
    } catch {
      setError("Failed to load scrape dates")
    } finally {
      setLoading(false)
    }
  }

  const handleSelectDate = async (date: string) => {
    try {
      setSelectedDate(date)
      setSelectedScrape(null)
      const scrapesList = await getRawScrapesForDate(date)
      setScrapes(scrapesList)
    } catch {
      // ignore
    }
  }

  const handleViewScrape = async (date: string, filename: string) => {
    try {
      const detail = await getRawScrapeDetail(date, filename)
      setSelectedScrape(detail)
    } catch {
      // ignore
    }
  }

  const filteredScrapes = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return scrapes
    return scrapes.filter((s) => s.filename.toLowerCase().includes(q) || s.url_slug.toLowerCase().includes(q))
  }, [scrapes, searchTerm])

  if (selectedScrape) {
    const MAX_PREVIEW_LINES = 120
    const contentLines = selectedScrape.content.split('\n')
    const isLong = contentLines.length > MAX_PREVIEW_LINES
    const displayedContent = expanded ? selectedScrape.content : contentLines.slice(0, MAX_PREVIEW_LINES).join('\n')
    return (
      <main className="mx-auto max-w-4xl p-6 space-y-6">
        <div className="flex items-center">
          <Button variant="outline" onClick={() => setSelectedScrape(null)}>
            ← Back to list
          </Button>
        </div>
        <div className="text-sm text-muted-foreground">
          <div className="font-medium">{selectedScrape.date}</div>
          <div className="truncate font-mono" title={selectedScrape.filename}>{selectedScrape.filename}</div>
        </div>

        <section className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold">Metadata</h2>
          <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <dt className="text-xs uppercase text-muted-foreground">Run ID</dt>
            <dd>
              <span className="inline-block rounded bg-muted px-2 py-1 font-mono text-xs break-all">
                {selectedScrape.metadata.run_id || "N/A"}
              </span>
            </dd>

            <dt className="text-xs uppercase text-muted-foreground">Fetched at</dt>
            <dd>{formatIsoDate(selectedScrape.metadata.fetched_at)}</dd>

            <dt className="text-xs uppercase text-muted-foreground">Original URL</dt>
            <dd className="truncate">
              {selectedScrape.metadata.original_url ? (
                <a className="text-primary underline" href={selectedScrape.metadata.original_url} target="_blank" rel="noopener noreferrer">
                  {selectedScrape.metadata.original_url}
                </a>
              ) : (
                "N/A"
              )}
            </dd>
          </dl>
        </section>

        <section className="rounded-lg border">
          <div className="flex items-center justify-between border-b p-4">
            <div>
              <h2 className="text-lg font-semibold">Raw content</h2>
              <p className="text-xs text-muted-foreground">Rendered as plain text; no parsing or external loading.</p>
            </div>
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              {wordCount.toLocaleString()} words • tokens≈{tokenEstimate.toLocaleString()}
            </div>
          </div>
          <pre className={`bg-muted p-4 text-xs whitespace-pre-wrap ${expanded ? 'max-h-[70vh]' : 'max-h-[50vh]'} overflow-auto`}>
            <code>{displayedContent}{!expanded && isLong ? '\n\n…\n' : ''}</code>
          </pre>
          {isLong && (
            <div className="flex justify-end border-t bg-background p-3">
              <Button size="sm" variant="outline" onClick={() => setExpanded(v => !v)}>
                {expanded ? 'Show less' : 'Show more'}
              </Button>
            </div>
          )}
        </section>
      </main>
    )
  }

  if (selectedDate) {
    return (
      <main className="mx-auto max-w-6xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setSelectedDate(null)}>
            ← Back to dates
          </Button>
          <h1 className="text-xl font-semibold">Scrapes for {selectedDate}</h1>
        </div>

        <div className="flex items-center justify-between">
          <input
            className="w-72 rounded-md border px-3 py-2 text-sm outline-none focus-visible:border-ring"
            placeholder="Search by filename or URL..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-2">Filename</th>
                <th className="px-4 py-2">Size</th>
                <th className="px-4 py-2">Created At</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredScrapes.map((s) => (
                <tr key={s.filename} className="border-t">
                  <td className="px-4 py-2 font-mono">{s.filename}</td>
                  <td className="px-4 py-2">{formatBytes(s.size_bytes)}</td>
                  <td className="px-4 py-2">{new Date(s.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label="View details"
                          onClick={() => handleViewScrape(s.date, s.filename)}
                        >
                          <Eye className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>View details</TooltipContent>
                    </Tooltip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Raw Scrapes</h1>
        <p className="text-sm text-muted-foreground">Browse raw markdown extracted from competitor pricing pages.</p>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Dates</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">URLs / Pricing</th>
                <th className="px-4 py-2">Total Size</th>
                <th className="px-4 py-2">Latest Created</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(loading ? Array.from({ length: 6 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="border-t">
                  <td className="px-4 py-2"><div className="h-4 w-32 animate-pulse rounded bg-muted" /></td>
                  <td className="px-4 py-2"><div className="h-4 w-24 animate-pulse rounded bg-muted" /></td>
                  <td className="px-4 py-2"><div className="h-4 w-24 animate-pulse rounded bg-muted" /></td>
                  <td className="px-4 py-2"><div className="h-4 w-40 animate-pulse rounded bg-muted" /></td>
                  <td className="px-4 py-2"><div className="h-8 w-20 animate-pulse rounded bg-muted" /></td>
                </tr>
              )) : dates.length ? (
                dates.map((d) => {
                  const runSummary = d.run_summary
                  const totalUrls = runSummary?.total_urls || 0
                  const pricingUrls = runSummary?.pricing_viable_urls || 0

                  return (
                    <tr key={d.date} className="border-t">
                      <td className="px-4 py-2 font-mono">{d.date}</td>
                      <td className="px-4 py-2">
                        {totalUrls > 0 ? (
                          <span className="text-sm">
                            <span className="font-medium">{totalUrls}</span> URLs
                            {pricingUrls > 0 && (
                              <span className="text-muted-foreground ml-1">/ {pricingUrls} pricing</span>
                            )}
                          </span>
                        ) : (
                          d.scrape_count
                        )}
                      </td>
                      <td className="px-4 py-2">{formatBytes(d.total_size_bytes)}</td>
                      <td className="px-4 py-2">{d.latest_created_at ? new Date(d.latest_created_at).toLocaleString() : "—"}</td>
                      <td className="px-4 py-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              aria-label="Browse scrapes for date"
                              onClick={() => handleSelectDate(d.date)}
                            >
                              <Eye className="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Browse scrapes</TooltipContent>
                        </Tooltip>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td className="px-4 py-6 text-center text-muted-foreground" colSpan={5}>No scrapes available</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}


