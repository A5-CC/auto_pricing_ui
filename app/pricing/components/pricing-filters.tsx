import { Button } from "@/components/ui/button"
import {
  MultiSelect,
  MultiSelectContent,
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
  import { useMemo } from "react"
  import type { PricingSchemas } from "@/lib/api/types"

  interface PricingFiltersProps {
    rows: any[]
    pricingSchemas: PricingSchemas | null
    selectedFilters: Record<string, string[]>
    setSelectedFilters: (next: Record<string, string[]>) => void
  }

  export function PricingFilters({ rows, pricingSchemas, selectedFilters, setSelectedFilters }: PricingFiltersProps) {
    const schemaCols = useMemo(() => {
      if (!pricingSchemas?.canonical?.columns) return [] as string[]
      return Object.keys(pricingSchemas.canonical.columns).sort()
    }, [pricingSchemas])

    const activeColumns = Object.keys(selectedFilters)

    const addFilterRow = () => {
      const col = schemaCols[0] ?? ""
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
              <Button variant="secondary" size="sm" onClick={addFilterRow}>Add filter</Button>
            </div>
          </div>
        </section>
      </>
    )
  }

  function FilterRow({ columnKey, rows, schemaCols, values, onChange, onRemove, onChangeColumn }: {
    columnKey: string
    rows: any[]
    schemaCols: string[]
    values: string[]
    onChange: (vals: string[]) => void
    onRemove: () => void
    onChangeColumn: (newCol: string) => void
  }) {
    const { allValues } = useUniversalFilter(rows ?? [], columnKey ?? "")

    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
        <div>
          <label className="block text-[12px] text-foreground/80 mb-1">Column</label>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={columnKey}
            onChange={(e) => onChangeColumn(e.target.value)}
          >
            {schemaCols.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-1">
          <label className="block text-[12px] text-foreground/80 mb-1">Values</label>
          <MultiSelect values={values} onValuesChange={onChange}>
            <MultiSelectTrigger className="w-full justify-between data-[placeholder]:text-foreground/70">
              <MultiSelectValue placeholder="Select values" />
            </MultiSelectTrigger>
            <MultiSelectContent search={{ placeholder: "Search values...", emptyMessage: "No values" }}>
              <MultiSelectGroup>
                {allValues.map((v) => (
                  <MultiSelectItem key={v} value={v}>{v}</MultiSelectItem>
                ))}
              </MultiSelectGroup>
            </MultiSelectContent>
          </MultiSelect>
        </div>

        <div className="flex items-end gap-2">
          <Button variant="secondary" size="sm" onClick={onRemove}>Remove</Button>
        </div>
      </div>
    )
  }
