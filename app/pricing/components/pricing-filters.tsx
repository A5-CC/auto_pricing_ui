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
 * Client-side filter controls for pricing data
 * Multi-select dropdowns for competitors, locations, dimensions, and unit categories
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
          {/* Competitors multi-select */}
          <div className="min-w-0">
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-[12px] text-foreground/80">Competitors</label>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedCompetitors([])}
                disabled={selectedCompetitors.length === 0}
                aria-label="Clear selected competitors"
              >
                Clear
              </Button>
            </div>
            <MultiSelect values={selectedCompetitors} onValuesChange={setSelectedCompetitors}>
              <MultiSelectTrigger className="w-full justify-between data-[placeholder]:text-foreground/70">
                <MultiSelectValue placeholder="Select competitors" />
              </MultiSelectTrigger>
              <MultiSelectContent search={{ placeholder: "Search competitors...", emptyMessage: "No competitors" }}>
                <MultiSelectGroup>
                  {allCompetitors.map((name) => (
                    <MultiSelectItem key={name} value={name}>{name}</MultiSelectItem>
                  ))}
                </MultiSelectGroup>
              </MultiSelectContent>
            </MultiSelect>
          </div>

          {/* ModLocation multi-select */}
          <div className="min-w-0">
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-[12px] text-foreground/80">ModLocation</label>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedLocations([])}
                disabled={selectedLocations.length === 0}
                aria-label="Clear selected locations"
              >
                Clear
              </Button>
            </div>
            <MultiSelect values={selectedLocations} onValuesChange={setSelectedLocations}>
              <MultiSelectTrigger className="w-full justify-between data-[placeholder]:text-foreground/70">
                <MultiSelectValue placeholder="Select locations" />
              </MultiSelectTrigger>
              <MultiSelectContent search={{ placeholder: "Search locations...", emptyMessage: "No locations" }}>
                <MultiSelectGroup>
                  {allLocations.map((name) => (
                    <MultiSelectItem key={name} value={name}>{name}</MultiSelectItem>
                  ))}
                </MultiSelectGroup>
              </MultiSelectContent>
            </MultiSelect>
          </div>

          {/* Dimensions multi-select */}
          <div className="min-w-0">
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-[12px] text-foreground/80">Dimensions</label>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedDimensions([])}
                disabled={selectedDimensions.length === 0}
                aria-label="Clear selected dimensions"
              >
                Clear
              </Button>
            </div>
            <MultiSelect values={selectedDimensions} onValuesChange={setSelectedDimensions}>
              <MultiSelectTrigger className="w-full justify-between data-[placeholder]:text-foreground/70">
                <MultiSelectValue placeholder="Select dimensions" />
              </MultiSelectTrigger>
              <MultiSelectContent search={{ placeholder: "Search dimensions...", emptyMessage: "No dimensions" }}>
                <MultiSelectGroup>
                  {allDimensions.map((name) => (
                    <MultiSelectItem key={name} value={name}>{name}</MultiSelectItem>
                  ))}
                </MultiSelectGroup>
              </MultiSelectContent>
            </MultiSelect>
          </div>

          {/* Unit Category multi-select */}
          <div className="min-w-0">
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-[12px] text-foreground/80">Unit Category</label>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedUnitCategories([])}
                disabled={selectedUnitCategories.length === 0}
                aria-label="Clear selected unit categories"
              >
                Clear
              </Button>
            </div>
            <MultiSelect values={selectedUnitCategories} onValuesChange={setSelectedUnitCategories}>
              <MultiSelectTrigger className="w-full justify-between data-[placeholder]:text-foreground/70">
                <MultiSelectValue placeholder="Select unit categories" />
              </MultiSelectTrigger>
              <MultiSelectContent search={{ placeholder: "Search categories...", emptyMessage: "No categories" }}>
                <MultiSelectGroup>
                  {allUnitCategories.map((name) => (
                    <MultiSelectItem key={name} value={name}>{name}</MultiSelectItem>
                  ))}
                </MultiSelectGroup>
              </MultiSelectContent>
            </MultiSelect>
          </div>
        </div>
      </section>
    </>
  )
}
