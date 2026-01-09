import { Button } from "@/components/ui/button"
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectGroup,
  MultiSelectItem,
  MultiSelectTrigger,
  MultiSelectValue,
} from "@/components/ui/multi-select"
import { SectionLabel } from "@/components/ui/section-label"
import { useUniversalFilter } from "@/hooks/useUniversalFilter"
import { useMemo, useState } from "react"
import type { E1DataRow } from "@/lib/api/types"

interface UniversalPipelineFiltersProps {
  rows: E1DataRow[]
  visibleColumns: string[]
  selectedFilters: Record<string, string[]>
  setSelectedFilters: (next: Record<string, string[]>) => void
  combinatoricFlags: Record<string, boolean>
  setCombinatoricFlags: (next: Record<string, boolean>) => void
}

export function UniversalPipelineFilters({ rows, visibleColumns, selectedFilters, setSelectedFilters, combinatoricFlags, setCombinatoricFlags }: UniversalPipelineFiltersProps) {
  const schemaCols = useMemo(() => {
    // visibleColumns are table column IDs; label = column ID (no separate canonical here)
    const cols = (visibleColumns ?? []).map((k) => ({ key: k, label: k }))
    cols.sort((a, b) => a.label.localeCompare(b.label))
    return cols
  }, [visibleColumns])

  const activeColumns = Object.keys(selectedFilters)

  const addFilterRow = () => {
    const first = schemaCols[0]
    const col = first ? first.key : ""
    if (!col) return
    setSelectedFilters({ ...selectedFilters, [col]: [] })
    setCombinatoricFlags({ ...combinatoricFlags, [col]: true })
  }

  const removeFilterRow = (col: string) => {
    const next = { ...selectedFilters }
    delete next[col]
    setSelectedFilters(next)
    const nextFlags = { ...combinatoricFlags }
    delete nextFlags[col]
    setCombinatoricFlags(nextFlags)
  }

  const changeColumnKey = (oldCol: string, newCol: string) => {
    const next = { ...selectedFilters }
    const vals = next[oldCol] ?? []
    delete next[oldCol]
    next[newCol] = vals
    setSelectedFilters(next)

    const nextFlags = { ...combinatoricFlags }
    const flag = nextFlags[oldCol]
    delete nextFlags[oldCol]
    nextFlags[newCol] = flag ?? true
    setCombinatoricFlags(nextFlags)
  }

  return (
    <>
      <SectionLabel text="Universal Filters" />
      <section className="rounded-lg border bg-background/50 p-3">
        <div className="space-y-3">
          {activeColumns.length === 0 && (
            <div className="text-sm text-muted-foreground">No filters — add one to begin</div>
          )}

          {activeColumns.map((col) => (
            <FilterRow
              key={col}
              columnKey={col}
              rows={rows}
              schemaCols={schemaCols}
              values={selectedFilters[col] ?? []}
              combinatoric={Boolean(combinatoricFlags[col])}
              onChange={(vals) => setSelectedFilters({ ...selectedFilters, [col]: vals })}
              onRemove={() => removeFilterRow(col)}
              onChangeColumn={(newCol) => changeColumnKey(col, newCol)}
              onToggleCombinatoric={(v) => setCombinatoricFlags({ ...combinatoricFlags, [col]: v })}
            />
          ))}

          <div>
            <Button variant="secondary" size="sm" onClick={addFilterRow}>Add filter</Button>
          </div>
        </div>
      </section>
    </>
  )
}

function FilterRow({ columnKey, rows, schemaCols, values, combinatoric, onChange, onRemove, onChangeColumn, onToggleCombinatoric }: {
  columnKey: string
  rows: E1DataRow[]
  schemaCols: { key: string; label: string }[]
  values: string[]
  combinatoric: boolean
  onChange: (vals: string[]) => void
  onRemove: () => void
  onChangeColumn: (newCol: string) => void
  onToggleCombinatoric: (v: boolean) => void
}) {
  const { allValues } = useUniversalFilter<E1DataRow>(rows ?? [], columnKey ?? "")
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const selectedLabel = schemaCols.find((s) => s.key === columnKey)?.label ?? columnKey

  const filteredCols = useMemo(() => {
    const q = query.trim().toLowerCase()
    return schemaCols.filter((c) => !q || c.label.toLowerCase().includes(q) || c.key.toLowerCase().includes(q))
  }, [schemaCols, query])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
      <div className="relative">
        <label className="block text-[12px] text-foreground/80 mb-1">Column</label>
        <input
          className="w-full rounded-md border px-3 py-2 text-sm h-12"
          value={open ? query : selectedLabel}
          onFocus={() => { setOpen(true); setQuery("") }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          placeholder="Search columns..."
          aria-label="Select column"
        />

        {open && (
          <div className="absolute z-40 mt-1 w-full rounded-md border bg-background shadow-lg max-h-60 overflow-auto">
            <ul>
              {filteredCols.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">No matches</li>
              ) : (
                filteredCols.map((c) => (
                  <li
                    key={c.key}
                    className="cursor-pointer px-3 py-2 hover:bg-muted/50 text-sm"
                    onMouseDown={(ev) => { ev.preventDefault(); onChangeColumn(c.key); setOpen(false); setQuery("") }}
                  >
                    <div className="font-medium">{c.label}</div>
                    <div className="text-xs text-muted-foreground">{c.key}</div>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>

      <div className="sm:col-span-1">
        <label className="block text-[12px] text-foreground/80 mb-1">Values</label>
        <div className="h-12">
          <MultiSelect values={values} onValuesChange={onChange}>
            <MultiSelectTrigger className="w-full justify-between data-[placeholder]:text-foreground/70 h-12">
              <MultiSelectValue placeholder="Select values" />
            </MultiSelectTrigger>

            <MultiSelectContent search={{ placeholder: "Search values...", emptyMessage: "No values" }}>
              <MultiSelectGroup>
                {allValues.map((v) => (
                  <MultiSelectItem key={String(v)} value={String(v)}>
                    {String(v)}
                  </MultiSelectItem>
                ))}
              </MultiSelectGroup>
            </MultiSelectContent>
          </MultiSelect>
        </div>

        <div className="mt-2 flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => onChange(allValues.map(String))}>All</Button>
          <Button variant="secondary" size="sm" onClick={() => onChange([])}>Clear</Button>
        </div>

        <div className="mt-2">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={combinatoric} onChange={(e) => onToggleCombinatoric(e.target.checked)} />
            <span className="text-[13px]">Combinatoric</span>
          </label>
        </div>
      </div>

      <div className="flex items-start gap-2">
        <Button variant="secondary" size="sm" onClick={onRemove}>Remove</Button>
      </div>
    </div>
  )
}
