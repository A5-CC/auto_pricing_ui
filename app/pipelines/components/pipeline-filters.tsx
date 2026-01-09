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
// import { useUniversalFilter } from "@/hooks/useUniversalFilter"
import { useMemo, useState } from "react"
import { getCanonicalLabel } from "@/lib/pricing/column-labels"
import type { PricingSchemas, E1DataRow } from "@/lib/api/types"

interface PricingFiltersProps {
  rows: E1DataRow[]
  pricingSchemas?: PricingSchemas | null
  visibleColumns?: string[]
  selectedFilters: Record<string, string[]>
  setSelectedFilters: (next: Record<string, string[]>) => void
  combinatoricFlags: Record<string, boolean>
  setCombinatoricFlags: (next: Record<string, boolean>) => void
}

export function PricingFilters({
  rows,
  pricingSchemas,
  visibleColumns,
  selectedFilters,
  setSelectedFilters,
  combinatoricFlags,
  setCombinatoricFlags,
}: PricingFiltersProps) {
  const schemaCols = useMemo(() => {
    const canonical = pricingSchemas?.canonical?.columns ?? {}
    const spine = pricingSchemas?.spine ?? []

    const keySet = new Set<string>()
    Object.keys(canonical).forEach((k) => keySet.add(k))
    for (const s of spine) keySet.add(s.id)
    ;(visibleColumns ?? []).forEach((c) => keySet.add(c))
    for (const r of rows ?? []) {
      if (typeof r === "object" && r !== null) {
        Object.keys(r).forEach((k) => keySet.add(k))
      }
    }

    const cols = Array.from(keySet).map((key) => ({ key, label: getCanonicalLabel(key, pricingSchemas ?? null) }))

    cols.sort((a, b) => a.label.localeCompare(b.label))
    return cols
  }, [pricingSchemas, visibleColumns, rows])

  const activeColumns = Object.keys(selectedFilters)

  const addFilterRow = () => {
    // Prefer a visible column (actual data column) when adding a new filter so
    // the Values list can be populated from the rows. Fall back to the first
    // schema column if no visibleColumns exist.
    const first = schemaCols[0]
    const visibleFirst = (visibleColumns ?? [])[0]
    const col = visibleFirst ?? (first ? first.key : "")
    if (!col) return
    setSelectedFilters({ ...selectedFilters, [col]: [] })
    setCombinatoricFlags({ ...combinatoricFlags, [col]: true })
  }

  const removeFilterRow = (col: string) => {
    const next = { ...selectedFilters }
    delete next[col]
    setSelectedFilters(next)
    const cf = { ...combinatoricFlags }
    delete cf[col]
    setCombinatoricFlags(cf)
  }

  const changeColumnKey = (oldCol: string, newCol: string) => {
    const next = { ...selectedFilters }
    const vals = next[oldCol] ?? []
    delete next[oldCol]
    next[newCol] = vals
    setSelectedFilters(next)
    const cf = { ...combinatoricFlags }
    cf[newCol] = cf[oldCol] ?? true
    delete cf[oldCol]
    setCombinatoricFlags(cf)
  }

  return (
    <>
      <SectionLabel text="Filters" />
      <section className="rounded-lg border bg-background/50 p-3">
        <div className="space-y-3">
          {activeColumns.length === 0 && (
            <div className="text-sm text-muted-foreground">No filters — add one to begin</div>
          )}

          {activeColumns.map((col) => {
            // Only show values present in the current rows for this column
            const presentValues = Array.from(new Set(rows.map(r => r[col]).filter(v => v != null)))
            return (
              <FilterRow
                key={col}
                columnKey={col}
                rows={rows}
                visibleColumns={visibleColumns}
                schemaCols={schemaCols}
                values={selectedFilters[col] ?? []}
                combinatoricFlag={Boolean(combinatoricFlags[col])}
                onChange={(vals) => setSelectedFilters({ ...selectedFilters, [col]: vals })}
                onRemove={() => removeFilterRow(col)}
                onChangeColumn={(newCol) => changeColumnKey(col, newCol)}
                onToggleCombinatoric={(v) => setCombinatoricFlags({ ...combinatoricFlags, [col]: v })}
                presentValues={presentValues}
              />
            )
          })}

          <div>
            <Button variant="secondary" size="sm" onClick={addFilterRow}>
              Add filter
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}

type FilterRowProps = {
  columnKey: string
  rows: E1DataRow[]
  visibleColumns?: string[]
  schemaCols: { key: string; label: string }[]
  values: string[]
  combinatoricFlag: boolean
  onChange: (vals: string[]) => void
  onRemove: () => void
  onChangeColumn: (newCol: string) => void
  onToggleCombinatoric: (v: boolean) => void
  presentValues: string[]
}
function FilterRow({ columnKey, rows, visibleColumns, schemaCols, values, combinatoricFlag, onChange, onRemove, onChangeColumn, onToggleCombinatoric, presentValues }: FilterRowProps) {
  // deriveDataColumn removed (unused)

  // const dataColumn = deriveDataColumn(columnKey)
  // Use presentValues for value population (from filtered dataset)
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
          onFocus={() => {
            setOpen(true)
            setQuery("")
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
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
                    onMouseDown={(ev) => {
                      ev.preventDefault()
                      onChangeColumn(c.key)
                      setOpen(false)
                      setQuery("")
                    }}
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
                {presentValues.map((v) => (
                  <MultiSelectItem key={v} value={v}>
                    {v}
                  </MultiSelectItem>
                ))}
              </MultiSelectGroup>
            </MultiSelectContent>
          </MultiSelect>
        </div>

        <div className="mt-2 flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => onChange(presentValues)}>
            All
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onChange([])}>
            Clear
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-2">
        <label className="inline-flex items-center gap-2 text-xs">
          <input type="checkbox" checked={combinatoricFlag} onChange={(e) => onToggleCombinatoric(e.target.checked)} />
          <span className="text-[11px]">Combinatoric</span>
        </label>

        <Button variant="secondary" size="sm" onClick={onRemove}>
          Remove
        </Button>
      </div>
    </div>
  )
}
