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

interface PricingFiltersProps {
  selectedCompetitors: string[]
  setSelectedCompetitors: (values: string[]) => void
  allCompetitors: string[]

  selectedLocations: string[]
  setSelectedLocations: (values: string[]) => void
  allLocations: string[]

  selectedDimensions: string[]
  setSelectedDimensions: (values: string[]) => void
  allDimensions: string[]

  selectedUnitCategories: string[]
  setSelectedUnitCategories: (values: string[]) => void
  allUnitCategories: string[]

  // NEW: flags and setters for All-mode
  competitorsAll?: boolean
  setCompetitorsAll?: (v: boolean) => void
  // NEW: combinatoric flags
  competitorsCombinatoric?: boolean
  setCompetitorsCombinatoric?: (v: boolean) => void

  locationsAll?: boolean
  setLocationsAll?: (v: boolean) => void
  locationsCombinatoric?: boolean
  setLocationsCombinatoric?: (v: boolean) => void

  dimensionsAll?: boolean
  setDimensionsAll?: (v: boolean) => void
  dimensionsCombinatoric?: boolean
  setDimensionsCombinatoric?: (v: boolean) => void

  unitCategoriesAll?: boolean
  setUnitCategoriesAll?: (v: boolean) => void
  unitCategoriesCombinatoric?: boolean
  setUnitCategoriesCombinatoric?: (v: boolean) => void
}

/**
 * Pricing filters
 *
 * Behavior:
 * - Empty selection [] means "no filtering" (include all)
 * - "All" mode is controlled by parent (competitorsAll, ...). The UI shows a toggle that flips that mode.
 * - When a filter is in All mode the multi-select is inactive (user cannot change values).
 */
export function PricingFilters({
  selectedCompetitors,
  setSelectedCompetitors,
  allCompetitors,

  selectedLocations,
  setSelectedLocations,
  allLocations,

  selectedDimensions,
  setSelectedDimensions,
  allDimensions,

  selectedUnitCategories,
  setSelectedUnitCategories,
  allUnitCategories,

  competitorsAll = false,
  setCompetitorsAll,
  competitorsCombinatoric = true,
  setCompetitorsCombinatoric,
  locationsAll = false,
  setLocationsAll,
  locationsCombinatoric = true,
  setLocationsCombinatoric,
  dimensionsAll = false,
  setDimensionsAll,
  dimensionsCombinatoric = true,
  setDimensionsCombinatoric,
  unitCategoriesAll = false,
  setUnitCategoriesAll,
  unitCategoriesCombinatoric = true,
  setUnitCategoriesCombinatoric,
}: PricingFiltersProps) {
  return (
    <>
      <SectionLabel text="Filters" />
      <section className="rounded-lg border bg-background/50 p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">

          <FilterBlock
            label="Competitors"
            selected={selectedCompetitors}
            options={allCompetitors}
            onClear={() => setSelectedCompetitors([])}
            onChange={setSelectedCompetitors}
            placeholder="Select competitors"
            searchPlaceholder="Search competitors..."
            allFlag={competitorsAll}
            onToggleAll={(v) => setCompetitorsAll?.(v)}
            combinatoricFlag={competitorsCombinatoric}
            onToggleCombinatoric={(v) => setCompetitorsCombinatoric?.(v)}
          />

          <FilterBlock
            label="modLocation"
            selected={selectedLocations}
            options={allLocations}
            onClear={() => setSelectedLocations([])}
            onChange={setSelectedLocations}
            placeholder="Select locations"
            searchPlaceholder="Search locations..."
            allFlag={locationsAll}
            onToggleAll={(v) => setLocationsAll?.(v)}
            combinatoricFlag={locationsCombinatoric}
            onToggleCombinatoric={(v) => setLocationsCombinatoric?.(v)}
          />

          <FilterBlock
            label="Dimensions"
            selected={selectedDimensions}
            options={allDimensions}
            onClear={() => setSelectedDimensions([])}
            onChange={setSelectedDimensions}
            placeholder="Select dimensions"
            searchPlaceholder="Search dimensions..."
            allFlag={dimensionsAll}
            onToggleAll={(v) => setDimensionsAll?.(v)}
            combinatoricFlag={dimensionsCombinatoric}
            onToggleCombinatoric={(v) => setDimensionsCombinatoric?.(v)}
          />

          <FilterBlock
            label="Unit Category"
            selected={selectedUnitCategories}
            options={allUnitCategories}
            onClear={() => setSelectedUnitCategories([])}
            onChange={setSelectedUnitCategories}
            placeholder="Select unit categories"
            searchPlaceholder="Search categories..."
            allFlag={unitCategoriesAll}
            onToggleAll={(v) => setUnitCategoriesAll?.(v)}
            combinatoricFlag={unitCategoriesCombinatoric}
            onToggleCombinatoric={(v) => setUnitCategoriesCombinatoric?.(v)}
          />

        </div>
      </section>
    </>
  )
}

interface FilterBlockProps {
  label: string
  selected: string[]
  options: string[]
  onClear: () => void
  onChange: (values: string[]) => void
  placeholder: string
  searchPlaceholder: string

  // NEW:
  allFlag?: boolean
  onToggleAll?: (value: boolean) => void
  combinatoricFlag?: boolean
  onToggleCombinatoric?: (value: boolean) => void
}

/**
 * FilterBlock renders:
 * - label + Clear + small "All" toggle
 * - MultiSelect
 *
 * When allFlag === true, the multiselect is inert (onChange is a noop) and the UI indicates All mode.
 */
function FilterBlock({
  label,
  selected,
  options,
  onClear,
  onChange,
  placeholder,
  searchPlaceholder,
  allFlag = false,
  onToggleAll,
  combinatoricFlag = true,
  onToggleCombinatoric,
}: FilterBlockProps) {
  // If All is active, we show no selected values in the multiselect and prevent changes
  const effectiveValues = allFlag ? [] : selected
  const effectiveOnChange = allFlag ? () => {} : onChange

  // handle All toggle: when turning ON, programmatically select all real options;
  // when turning OFF, clear the selection. Then sync the parent's flag.
  const handleAllClick = () => {
    if (!allFlag) {
      // Toggle ON: select all real options
      onChange(options ?? [])
    } else {
      // Toggle OFF: clear selection
      onChange([])
    }
    onToggleAll?.(!allFlag) // keep the external flag in sync
  }

  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="block text-[12px] text-foreground/80">
          {label}
        </label>

        <div className="flex items-center gap-2">
          {/* Clear button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={onClear}
            disabled={selected.length === 0}
          >
            Clear
          </Button>

          {/* All toggle */}
          <button
            type="button"
            aria-pressed={allFlag}
            onClick={handleAllClick}
            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold ${allFlag ? 'bg-primary/10 text-primary' : 'bg-muted/10 text-muted-foreground'}`}
            title={allFlag ? `Showing all ${label}` : `Select specific ${label}`}
          >
            All
          </button>

          {/* Combinatoric toggle */}
          <label className="inline-flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={combinatoricFlag}
              onChange={(e) => onToggleCombinatoric?.(e.target.checked)}
            />
            <span className="text-[11px]">Combinatoric</span>
          </label>
        </div>
      </div>

      <MultiSelect
        values={effectiveValues}
        onValuesChange={effectiveOnChange}
      >
        <MultiSelectTrigger className="w-full justify-between data-[placeholder]:text-foreground/70">
          <MultiSelectValue placeholder={allFlag ? `All ${label}` : placeholder} />
        </MultiSelectTrigger>

        <MultiSelectContent
          search={{
            placeholder: searchPlaceholder,
            emptyMessage: "No results",
          }}
        >
          <MultiSelectGroup>
            {options.map((value) => (
              <MultiSelectItem key={value} value={value}>
                {value}
              </MultiSelectItem>
            ))}
          </MultiSelectGroup>
        </MultiSelectContent>
      </MultiSelect>
    </div>
  )
}
