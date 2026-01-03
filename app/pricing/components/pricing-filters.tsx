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
}

/**
 * Pricing filters with built-in "All" selection logic:
 * - "All" is mutually exclusive
 * - Selecting any other value removes "All"
 * - When "All" is selected, other values are hidden
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
}: PricingFiltersProps) {



  return (
    <>
      <SectionLabel text="Filters" />
      <section className="rounded-lg border bg-background/50 p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">

          <FilterBlock
            label="Competitors"
            selected={selectedCompetitors}
            all={allCompetitors}
            onClear={() => setSelectedCompetitors([])}
            onChange={setSelectedCompetitors}
            placeholder="Select competitors"
            searchPlaceholder="Search competitors..."
          />

          <FilterBlock
            label="ModLocation"
            selected={selectedLocations}
            all={allLocations}
            onClear={() => setSelectedLocations([])}
            onChange={setSelectedCompetitors}
            placeholder="Select locations"
            searchPlaceholder="Search locations..."
          />

          <FilterBlock
            label="Dimensions"
            selected={selectedDimensions}
            all={allDimensions}
            onClear={() => setSelectedDimensions([])}
            onChange={setSelectedCompetitors}
            placeholder="Select dimensions"
            searchPlaceholder="Search dimensions..."
          />

          <FilterBlock
            label="Unit Category"
            selected={selectedUnitCategories}
            all={allUnitCategories}
            onClear={() => setSelectedUnitCategories([])}
            onChange={setSelectedCompetitors}
            placeholder="Select unit categories"
            searchPlaceholder="Search categories..."
          />

        </div>
      </section>
    </>
  )
}

interface FilterBlockProps {
  label: string
  selected: string[]
  all: string[]
  onClear: () => void
  onChange: (values: string[]) => void
  placeholder: string
  searchPlaceholder: string
}

function FilterBlock({
  label,
  selected,
  all,
  onClear,
  onChange,
  placeholder,
  searchPlaceholder,
}: FilterBlockProps) {
  const options = all


  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between">
        <label className="block text-[12px] text-foreground/80">
          {label}
        </label>
        <Button
          variant="secondary"
          size="sm"
          onClick={onClear}
          disabled={selected.length === 0}
        >
          Clear
        </Button>
      </div>

      <MultiSelect values={selected} onValuesChange={onChange}>
        <MultiSelectTrigger className="w-full justify-between data-[placeholder]:text-foreground/70">
          <MultiSelectValue placeholder={placeholder} />
        </MultiSelectTrigger>

        <MultiSelectContent
          search={{ placeholder: searchPlaceholder, emptyMessage: "No results" }}
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
