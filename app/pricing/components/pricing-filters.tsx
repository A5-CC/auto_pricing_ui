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
  // Helper to add "All" option at the top and handle disabling others
  const buildItems = (allItems: string[], selected: string[]) => {
    const items = ["All", ...allItems]
    return items.map((item) => ({
      value: item,
      disabled: selected.includes("All") && item !== "All",
    }))
  }

  const handleChange = (
    selected: string[],
    setSelected: (vals: string[]) => void
  ) => {
    if (selected.includes("All")) {
      setSelected(["All"])
    } else {
      setSelected(selected.filter((v) => v !== "All"))
    }
  }

  return (
    <>
      <SectionLabel text="Filters" />
      <section className="rounded-lg border bg-background/50 p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {/* Competitors */}
          <div className="min-w-0">
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-[12px] text-foreground/80">Competitors</label>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedCompetitors([])}
                disabled={selectedCompetitors.length === 0}
              >
                Clear
              </Button>
            </div>
            <MultiSelect
              values={selectedCompetitors}
              onValuesChange={(vals) => handleChange(vals, setSelectedCompetitors)}
            >
              <MultiSelectTrigger className="w-full justify-between data-[placeholder]:text-foreground/70">
                <MultiSelectValue placeholder="Select competitors" />
              </MultiSelectTrigger>
              <MultiSelectContent search={{ placeholder: "Search competitors...", emptyMessage: "No competitors" }}>
                <MultiSelectGroup>
                  {buildItems(allCompetitors, selectedCompetitors).map(({ value, disabled }) => (
                    <MultiSelectItem key={value} value={value} disabled={disabled}>{value}</MultiSelectItem>
                  ))}
                </MultiSelectGroup>
              </MultiSelectContent>
            </MultiSelect>
          </div>

          {/* Locations */}
          <div className="min-w-0">
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-[12px] text-foreground/80">ModLocation</label>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedLocations([])}
                disabled={selectedLocations.length === 0}
              >
                Clear
              </Button>
            </div>
            <MultiSelect
              values={selectedLocations}
              onValuesChange={(vals) => handleChange(vals, setSelectedLocations)}
            >
              <MultiSelectTrigger className="w-full justify-between data-[placeholder]:text-foreground/70">
                <MultiSelectValue placeholder="Select locations" />
              </MultiSelectTrigger>
              <MultiSelectContent search={{ placeholder: "Search locations...", emptyMessage: "No locations" }}>
                <MultiSelectGroup>
                  {buildItems(allLocations, selectedLocations).map(({ value, disabled }) => (
                    <MultiSelectItem key={value} value={value} disabled={disabled}>{value}</MultiSelectItem>
                  ))}
                </MultiSelectGroup>
              </MultiSelectContent>
            </MultiSelect>
          </div>

          {/* Dimensions */}
          <div className="min-w-0">
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-[12px] text-foreground/80">Dimensions</label>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedDimensions([])}
                disabled={selectedDimensions.length === 0}
              >
                Clear
              </Button>
            </div>
            <MultiSelect
              values={selectedDimensions}
              onValuesChange={(vals) => handleChange(vals, setSelectedDimensions)}
            >
              <MultiSelectTrigger className="w-full justify-between data-[placeholder]:text-foreground/70">
                <MultiSelectValue placeholder="Select dimensions" />
              </MultiSelectTrigger>
              <MultiSelectContent search={{ placeholder: "Search dimensions...", emptyMessage: "No dimensions" }}>
                <MultiSelectGroup>
                  {buildItems(allDimensions, selectedDimensions).map(({ value, disabled }) => (
                    <MultiSelectItem key={value} value={value} disabled={disabled}>{value}</MultiSelectItem>
                  ))}
                </MultiSelectGroup>
              </MultiSelectContent>
            </MultiSelect>
          </div>

          {/* Unit Category */}
          <div className="min-w-0">
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-[12px] text-foreground/80">Unit Category</label>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedUnitCategories([])}
                disabled={selectedUnitCategories.length === 0}
              >
                Clear
              </Button>
            </div>
            <MultiSelect
              values={selectedUnitCategories}
              onValuesChange={(vals) => handleChange(vals, setSelectedUnitCategories)}
            >
              <MultiSelectTrigger className="w-full justify-between data-[placeholder]:text-foreground/70">
                <MultiSelectValue placeholder="Select unit categories" />
              </MultiSelectTrigger>
              <MultiSelectContent search={{ placeholder: "Search categories...", emptyMessage: "No categories" }}>
                <MultiSelectGroup>
                  {buildItems(allUnitCategories, selectedUnitCategories).map(({ value, disabled }) => (
                    <MultiSelectItem key={value} value={value} disabled={disabled}>{value}</MultiSelectItem>
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
