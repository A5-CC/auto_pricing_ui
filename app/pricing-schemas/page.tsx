"use client"

import { useEffect, useMemo, useState } from "react"
import { getPricingSchemas, getSchemaStats } from "@/lib/api/client"
import type { PricingSchemas, SpineColumn, CanonicalWideSchema, SchemaStats } from "@/lib/api/types"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ContextChips } from "@/components/context-chips"
import { useContextChips } from "@/hooks/useContextChips"
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectItem,
  MultiSelectTrigger,
  MultiSelectValue,
} from "@/components/ui/multi-select"

function formatDate(value?: string) {
  if (!value) return "—"
  try {
    const date = new Date(value)
    // Check if date is valid
    if (isNaN(date.getTime())) return value

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date)
  } catch {
    return value
  }
}

export default function PricingSchemasPage() {
  const [schemas, setSchemas] = useState<PricingSchemas | null>(null)
  const [stats, setStats] = useState<SchemaStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const { createChips } = useContextChips()

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const [s, st] = await Promise.all([getPricingSchemas(), getSchemaStats()])
        setSchemas(s)
        setStats(st)
      } catch {
        setError("Failed to load pricing schemas")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const canonicalEntries = useMemo(() => {
    const entries: Array<{ name: string; meta: CanonicalWideSchema["columns"][string] }> = []
    if (schemas?.canonical?.columns) {
      for (const [name, meta] of Object.entries(schemas.canonical.columns)) {
        entries.push({ name, meta })
      }
    }
    const q = query.trim().toLowerCase()
    return entries
      .filter(({ name, meta }) =>
        (!q || name.toLowerCase().includes(q) || (meta.label || "").toLowerCase().includes(q) || (meta.description || "").toLowerCase().includes(q)) &&
        (selectedTypes.length === 0 || selectedTypes.includes(meta.type))
      )
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [schemas?.canonical, query, selectedTypes])

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <ContextChips
        chips={createChips(
          {
            label: "Pricing Schema",
            isCurrent: true
          }
        )}
      />
      <p className="text-sm text-muted-foreground">Evolved, wide-format schema powering competitor pricing analytics.</p>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Spine columns" value={stats?.spine_columns ?? (schemas?.spine?.length ?? "—")} />
        <StatCard label="Canonical columns" value={stats?.canonical_columns ?? (schemas?.canonical?.total_columns ?? "—")} />
        <StatCard label="Schema version" value={stats?.schema_version ?? (schemas?.canonical?.version ?? "—")} />
      </section>

      <section className="space-y-6">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="border-b p-4">
              <h2 className="text-lg font-semibold">Spine</h2>
              <p className="text-xs text-muted-foreground">Immutable primary key columns</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-4 py-2">ID</th>
                    <th className="px-4 py-2">Label</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {(loading ? Array.from({ length: 4 }).map((_, i) => (
                    <tr key={`skeleton-sp-${i}`} className="border-t">
                      <td className="px-4 py-2"><div className="h-4 w-40 animate-pulse rounded bg-muted" /></td>
                      <td className="px-4 py-2"><div className="h-4 w-32 animate-pulse rounded bg-muted" /></td>
                      <td className="px-4 py-2"><div className="h-4 w-16 animate-pulse rounded bg-muted" /></td>
                      <td className="px-4 py-2"><div className="h-4 w-64 animate-pulse rounded bg-muted" /></td>
                    </tr>
                  )) : (schemas?.spine?.length ? (
                    schemas.spine.map((c: SpineColumn) => (
                      <tr key={c.id} className="border-t align-top">
                        <td className="px-4 py-2 font-mono text-xs">{c.id}</td>
                        <td className="px-4 py-2">{c.label}</td>
                        <td className="px-4 py-2"><TypeBadge type={c.type} /></td>
                        <td className="px-4 py-2 text-muted-foreground">{c.description}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No spine columns</td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="border-b p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Canonical</h2>
                  <p className="text-xs text-muted-foreground">Evolving wide schema</p>
                </div>
                {schemas?.canonical?.last_updated && (
                  <Badge variant="outline">Updated {formatDate(schemas.canonical.last_updated)}</Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 p-4">
              <input
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:border-ring"
                placeholder="Search name, label, description"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <MultiSelect values={selectedTypes} onValuesChange={setSelectedTypes}>
                <MultiSelectTrigger className="min-w-[10rem]">
                  <MultiSelectValue placeholder="Filter types" />
                </MultiSelectTrigger>
                <MultiSelectContent search={{ placeholder: "Search type..." }}>
                  <MultiSelectItem value="string">String</MultiSelectItem>
                  <MultiSelectItem value="decimal">Decimal</MultiSelectItem>
                  <MultiSelectItem value="integer">Integer</MultiSelectItem>
                  <MultiSelectItem value="boolean">Boolean</MultiSelectItem>
                </MultiSelectContent>
              </MultiSelect>
              <Button variant="outline" size="sm" onClick={() => { setQuery(""); setSelectedTypes([]) }}>Reset</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Label</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">First Seen</th>
                    <th className="px-4 py-2">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {(loading ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={`skeleton-cn-${i}`} className="border-t">
                      <td className="px-4 py-2"><div className="h-4 w-48 animate-pulse rounded bg-muted" /></td>
                      <td className="px-4 py-2"><div className="h-4 w-40 animate-pulse rounded bg-muted" /></td>
                      <td className="px-4 py-2"><div className="h-4 w-16 animate-pulse rounded bg-muted" /></td>
                      <td className="px-4 py-2"><div className="h-4 w-28 animate-pulse rounded bg-muted" /></td>
                      <td className="px-4 py-2"><div className="h-4 w-64 animate-pulse rounded bg-muted" /></td>
                    </tr>
                  )) : (canonicalEntries.length ? (
                    canonicalEntries.map(({ name, meta }) => (
                      <tr key={name} className="border-t align-top">
                        <td className="px-4 py-2 font-mono text-xs">{name}</td>
                        <td className="px-4 py-2">{meta.label || "—"}</td>
                        <td className="px-4 py-2"><TypeBadge type={meta.type} /></td>
                        <td className="px-4 py-2">{formatDate(meta.first_seen)}</td>
                        <td className="px-4 py-2 text-muted-foreground">{meta.description || ""}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No canonical columns</td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase text-muted-foreground">{label}</div>
        <div className="mt-1 text-xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  )
}

function TypeBadge({ type }: { type: string }) {
  const color = type === 'decimal' ? 'bg-blue-100 text-blue-800' : type === 'integer' ? 'bg-violet-100 text-violet-800' : type === 'boolean' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${color}`}>{type}</span>
}


