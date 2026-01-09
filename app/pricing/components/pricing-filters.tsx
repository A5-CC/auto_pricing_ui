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
import { useMemo, useState, useRef } from "react"
import type { PricingSchemas, PricingDataRow } from "@/lib/api/types"

interface PricingFiltersProps {
  rows: PricingDataRow[]
  pricingSchemas: PricingSchemas | null
  selectedFilters: Record<string, string[]>
  setSelectedFilters: (next: Record<string, string[]>) => void
  extraColumns?: string[]
}

export function PricingFilters({
  rows,
  pricingSchemas,
  selectedFilters,
  setSelectedFilters,
  extraColumns,
}: PricingFiltersProps) {
  const schemaCols = useMemo(() => {
    const canonical = pricingSchemas?.canonical?.columns ?? {}
    const spine = pricingSchemas?.spine ?? []

    const keySet = new Set<string>()
    Object.keys(canonical).forEach((k) => keySet.add(k))
    for (const s of spine) keySet.add(s.id)
    ;(extraColumns ?? []).forEach((k) => keySet.add(k))

    const cols = Array.from(keySet).map((key) => {
      const label = canonical[key]?.label ?? spine.find((s) => s.id === key)?.label ?? key
      return { key, label }
    })

    cols.sort((a, b) => a.label.localeCompare(b.label))
    return cols
  }, [pricingSchemas, extraColumns])

  const activeColumns = Object.keys(selectedFilters)

  const addFilterRow = () => {
    const first = schemaCols[0]
    const col = first ? first.key : ""
    if (!col) return
    setSelectedFilters({ ...selectedFilters, [col]: [] })
  }

  const removeFilterRow = (col: string) => {
    const next = { ...selectedFilters }
    delete next[col]
    setSelectedFilters(next)
  }

  const changeColumnKey = (oldCol: string, newCol: string) => {
    const next = { ...selectedFilters }
    const vals = next[oldCol] ?? []
    delete next[oldCol]
    next[newCol] = vals
    setSelectedFilters(next)
  }

  return (
    <>
      <SectionLabel text="Filters" />
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
              onChange={(vals) => setSelectedFilters({ ...selectedFilters, [col]: vals })}
              onRemove={() => removeFilterRow(col)}
              onChangeColumn={(newCol) => changeColumnKey(col, newCol)}
            />
          ))}

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
  rows: PricingDataRow[]
  schemaCols: { key: string; label: string }[]
  values: string[]
  onChange: (vals: string[]) => void
  onRemove: () => void
  onChangeColumn: (newCol: string) => void
}

function FilterRow({ columnKey, rows, schemaCols, values, onChange, onRemove, onChangeColumn }: FilterRowProps) {
  const { allValues } = useUniversalFilter<PricingDataRow>(rows ?? [], columnKey ?? "")
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const containerRef = useRef<HTMLDivElement | null>(null)

  const selectedLabel = schemaCols.find((s) => s.key === columnKey)?.label ?? columnKey

  const filteredCols = useMemo(() => {
    const q = query.trim().toLowerCase()
    return schemaCols.filter((c) => !q || c.label.toLowerCase().includes(q) || c.key.toLowerCase().includes(q))
  }, [schemaCols, query])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch">
      <div className="relative flex flex-col h-full" ref={containerRef}>
        <label className="block text-[12px] text-foreground/80 mb-1">Column</label>
        <input
          className="w-full rounded-md border px-3 py-2 text-sm flex-1"
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

      <div className="sm:col-span-1 flex flex-col h-full">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-[12px] text-foreground/80 mb-1">Values</label>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => onChange(allValues)}>
              All
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onChange([])}>
              Clear
            </Button>
          </div>
        </div>

        <div className="flex-1">
          <MultiSelect values={values} onValuesChange={onChange}>
            <MultiSelectTrigger className="w-full justify-between data-[placeholder]:text-foreground/70 h-full">
              <MultiSelectValue placeholder="Select values" />
            </MultiSelectTrigger>

            <MultiSelectContent search={{ placeholder: "Search values...", emptyMessage: "No values" }}>
              <MultiSelectGroup>
                {allValues.map((v) => (
                  <MultiSelectItem key={v} value={v}>
                    {v}
                  </MultiSelectItem>
                ))}
              </MultiSelectGroup>
            </MultiSelectContent>
          </MultiSelect>
        </div>
      </div>

      <div className="flex items-end gap-2">
        <Button variant="secondary" size="sm" onClick={onRemove}>
          Remove
        </Button>
      </div>
    </div>
  )
}
