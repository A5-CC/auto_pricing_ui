"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getE1Snapshots,
  getE1Competitors,
  getE1Client,
  getE1CompetitorsStatistics,
} from "@/lib/api/client/pipelines";
import type {
  E1Snapshot,
  E1DataResponse,
  ColumnStatistics,
} from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ContextChips } from "@/components/context-chips";
import { useContextChips } from "@/hooks/useContextChips";
import { useSortableRows } from "@/hooks/useSortableRows";
import { useCompetitorFilter } from "@/hooks/useCompetitorFilter";
import { useLocationFilter } from "@/hooks/useLocationFilter";
import { useDimensionsFilter } from "@/hooks/useDimensionsFilter";
import { useUnitCategoryFilter } from "@/hooks/useUnitCategoryFilter";
import { SectionLabel } from "@/components/ui/section-label";
import { PricingOverview } from "../pricing/components/pricing-overview";
import { PricingFilters } from "../pipelines/components/pipeline-filters";
import { PipelineSelector } from "@/components/pipelines/pipeline-selector";
import { AdjustersList } from "@/components/pipelines/adjusters-list";
import { CalculatedPrice } from "@/components/pipelines/calculated-price";
import { AddCompetitiveAdjusterDialog } from "@/components/pipelines/adjusters/add-competitive-adjuster-dialog";
import { AddFunctionAdjusterDialog } from "@/components/pipelines/adjusters/add-function-adjuster-dialog";
import { AddTemporalAdjusterDialog } from "@/components/pipelines/adjusters/add-temporal-adjuster-dialog";
import { useAdjusterDialog } from "@/components/pipelines/adjusters/use-adjuster-dialog";
import { PriceDataWarning } from "@/components/pipelines/price-data-warning";
import type { PipelineFilters as PipelineFiltersType, Pipeline } from "@/lib/api/types";
import type { Adjuster } from "@/lib/adjusters";
import { hasValidCompetitorPrices, getPriceDiagnostics } from "@/lib/adjusters";
import { TrendingDown, Calculator, Clock, Plus } from "lucide-react";

/**
 * Filter shape we will pass to CalculatedPrice.
 * This mirrors the types used by CalculatedPrice (mode: 'all' | subset).
 */
type CalcFilter = { mode: "all" } | { mode: "subset"; values: string[] };
type CalcFiltersShape = {
  competitors: CalcFilter;
  locations: CalcFilter;
  dimensions: CalcFilter;
  unit_categories: CalcFilter;
};
type PricingRow = {
  competitor_name?: string
  [key: string]: string | number | null | undefined
};


export default function PipelinesPage() {
  /* ---------------- State ---------------- */
  const [snapshots, setSnapshots] = useState<E1Snapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string>("latest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localAdjusters, setLocalAdjusters] = useState<Adjuster[]>([]);

  // dialogs
  const competitiveDialog = useAdjusterDialog();
  const functionDialog = useAdjusterDialog();
  const temporalDialog = useAdjusterDialog();

  // filters (explicit values)
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>(
    []
  );
  const [selectedLocations, setSelectedLocations] = useState<string[]>(
    []
  );
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>(
    []
  );
  const [selectedUnitCategories, setSelectedUnitCategories] = useState<
    string[]
  >([]);

  // "All" flags (user intent). We'll expand these into explicit subsets
  // based on actual competitor values when building calcFilters.
  const [competitorsAll, setCompetitorsAll] = useState<boolean>(false);
  const [locationsAll, setLocationsAll] = useState<boolean>(false);
  const [dimensionsAll, setDimensionsAll] = useState<boolean>(false);
  const [unitCategoriesAll, setUnitCategoriesAll] = useState<boolean>(false);
  // combinatoric flags (default true -> behave as before)
  const [competitorsCombinatoric, setCompetitorsCombinatoric] = useState<boolean>(true);
  const [locationsCombinatoric, setLocationsCombinatoric] = useState<boolean>(true);
  const [dimensionsCombinatoric, setDimensionsCombinatoric] = useState<boolean>(true);
  const [unitCategoriesCombinatoric, setUnitCategoriesCombinatoric] = useState<boolean>(true);

  // Universal pipeline filters (column -> values)
  const [universalFilters, setUniversalFilters] = useState<Record<string, string[]>>({});
  const [universalCombinatoric, setUniversalCombinatoric] = useState<Record<string, boolean>>({});

  // data
  const [dataResponse, setDataResponse] = useState<E1DataResponse | null>(
    null
  );
  const [clientDataResponse, setClientDataResponse] =
    useState<E1DataResponse | null>(null);

  // column statistics & visible columns
  const [columnsStats, setColumnsStats] = useState<
    Record<string, ColumnStatistics>
  >({});
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);

  /* ---------------- Derived filters from hooks ---------------- */
  const { filteredRows: competitorFilteredRows, allCompetitors } =
    useCompetitorFilter(dataResponse?.data ?? [], selectedCompetitors);
  const { filteredRows, allLocations } = useLocationFilter(
    competitorFilteredRows,
    selectedLocations,
    "modstorage_location"
  );
  const { filteredRows: locationAndDimFilteredRows, allDimensions } =
    useDimensionsFilter(filteredRows, selectedDimensions);
  const { filteredRows: fullyFilteredRows, allUnitCategories } =
    useUnitCategoryFilter(locationAndDimFilteredRows, selectedUnitCategories);

  /* ---------------- Sorting / pagination / grouping ---------------- */
  const {
    sortedRows: displayedRows,
    sortBy,
    sortDir,
    setSortBy,
    setSortDir,
  } = useSortableRows(fullyFilteredRows, columnsStats, null, "asc");

  // we only need setter here for resets; don't need the value in the UI itself
  const [, setCurrentPage] = useState(1);

  const [groupBy] = useState<string | null>(null);
  const [, setExpandedGroups] = useState<Set<string>>(new Set());
  const { createChips } = useContextChips();

  const grouped = useMemo(() => {
    if (!groupBy) return null;
    const map = new Map<string, typeof displayedRows>();
    for (const row of displayedRows) {
      const raw = row[groupBy as keyof typeof row];
      const key =
        raw === null || raw === undefined || raw === "" ? "—" : String(raw);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    const keys = Array.from(map.keys()).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );
    return { keys, map };
  }, [displayedRows, groupBy]);

  useEffect(() => {
    if (!groupBy) {
      setExpandedGroups(new Set());
      return;
    }
    if (grouped) setExpandedGroups(new Set(grouped.keys));
  }, [groupBy, grouped]);

  /* ---------------- Data loading ---------------- */
  const loadSnapshots = async () => {
    try {
      const s = await getE1Snapshots();
      setSnapshots(s);
    } catch {
      /* ignore */
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getE1Competitors(selectedSnapshot, { limit: 10000 });
      setDataResponse(res);

      const clientRes = await getE1Client(selectedSnapshot, { limit: 10000 });
      setClientDataResponse(clientRes);

      if (res.columns?.length) {
        const stats = await getE1CompetitorsStatistics(
          selectedSnapshot,
          res.columns
        );
        const byName = Object.fromEntries(stats.map((s) => [s.column, s]));
        setColumnsStats(byName);

        const fixedColumns = [
          "competitor_name",
          "competitor_address",
          "location_normalized",
          "snapshot_date",
          "dimensions_normalized",
        ];
        const filteredColumns = res.columns.filter(
          (col) => !fixedColumns.includes(col)
        );
        setVisibleColumns((prev) => (prev.length ? prev : filteredColumns));
      }
    } catch {
      setError("Failed to load E1 data");
    } finally {
      setLoading(false);
    }
  }, [selectedSnapshot]);

  useEffect(() => {
    loadSnapshots();
    loadData(); // initial load
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [selectedSnapshot, loadData]);


  /* ---------------- Helpers: derive actual competitor values ---------------- */

  // derive unique, non-empty string values from the competitor dataset (exclude client rows)
  const deriveCompetitorValues = (columnName: string) => {
    const rows = (dataResponse?.data ?? []) as PricingRow[]
    const set = new Set<string>()

    for (const r of rows) {
      // skip client rows
      if (r.competitor_name === "modSTORAGE") continue

      const v = r[columnName]
      if (v === null || v === undefined) continue

      const s = String(v).trim()
      if (s.length === 0) continue

      set.add(s)
    }

    return Array.from(set).sort()
  }


  const deriveValuesForKey = (key: keyof CalcFiltersShape) => {
    switch (key) {
      case "competitors":
        return deriveCompetitorValues("competitor_name");
      case "locations":
        return deriveCompetitorValues("location_normalized");
      case "dimensions":
        return deriveCompetitorValues("dimensions_normalized");
      case "unit_categories":
        // prefer hook-provided values if they exist (they come from competitor rows),
        // otherwise try to derive from a reasonable column name fallback
        if (allUnitCategories && allUnitCategories.length > 0) return allUnitCategories;
        return deriveCompetitorValues("unit_category") // fallback guess
      default:
        return [] as string[];
    }
  };

  /* ---------------- Pipeline load/save handlers ---------------- */
  const handleLoadPipeline = (filters: PipelineFiltersType) => {
    setSelectedCompetitors(filters.competitors);
    setSelectedLocations(filters.locations);
    setSelectedDimensions(filters.dimensions);
    setSelectedUnitCategories(filters.unit_categories);
  };

  const handlePipelineChange = (pipeline: Pipeline | null) => {
    setLocalAdjusters(pipeline?.adjusters || []);
  };

  /* ---------------- Adjuster actions ---------------- */
  const handleAddAdjuster = (adjuster: Adjuster) => {
    setLocalAdjusters((prev) => [...prev, adjuster]);
  };

  const handleRemoveAdjuster = (index: number) => {
    const nextAdjusters = localAdjusters.filter((_, idx) => idx !== index);

    if (nextAdjusters.length > 0) {
      const nextFirst = nextAdjusters[0];
      if (nextFirst.type !== "competitive") {
        toast.warning(
          <span>
            Cannot remove this adjuster because the pipeline must start with a{" "}
            <strong>Competitive</strong> step.
          </span>,
          { duration: 5400 }
        );
        return;
      }
    }

    setLocalAdjusters(nextAdjusters);
  };

  /* ---------------- Current date + diagnostics ---------------- */
  const currentDate = useMemo(() => new Date(), []);
  const canAddAdjusters = useMemo(
    () => hasValidCompetitorPrices(fullyFilteredRows),
    [fullyFilteredRows]
  );

  const hasCompetitiveAdjuster = localAdjusters.some(
    (adj) => adj.type === "competitive"
  );
  const firstAdjusterIsCompetitive =
    localAdjusters.length === 0 || localAdjusters[0].type === "competitive";
  const pipelineNeedsBase =
    localAdjusters.length > 0 && !firstAdjusterIsCompetitive;
  const canAddNonCompetitiveAdjusters =
    canAddAdjusters && hasCompetitiveAdjuster && firstAdjusterIsCompetitive;

  const priceDiagnostics = useMemo(
    () => getPriceDiagnostics(fullyFilteredRows),
    [fullyFilteredRows]
  );

  /* ---------------- Available variables for function adjuster ---------------- */
  const availableVariables = useMemo(() => {
    // const allColumnsWithType = Object.entries(columnsStats).map(
    //   ([col, stats]) => ({
    //     column: col,
    //     data_type: stats.data_type,
    //   })
    // );

    const numericCols = Object.entries(columnsStats)
      .filter(([, stats]) => {
        const dtype = stats.data_type.toLowerCase();
        return dtype.includes("int") || dtype.includes("float");
      })
      .map(([col]) => col)
      .sort();

    return numericCols;
  }, [columnsStats]);

  /* ---------------- Reset sort/pagination when inputs change ---------------- */
  useEffect(() => {
    setSortBy(null);
    setSortDir("asc");
  }, [
    selectedSnapshot,
    selectedCompetitors,
    selectedLocations,
    selectedDimensions,
    selectedUnitCategories,
    setSortBy,
    setSortDir,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedSnapshot,
    selectedCompetitors,
    selectedLocations,
    selectedDimensions,
    selectedUnitCategories,
    sortBy,
    sortDir,
  ]);

  /* ---------------- Wrapped setters (clear All flag on manual selection) ---------------- */
  const handleSetSelectedCompetitors = (vals: string[]) => {
    if (vals.length > 0 && competitorsAll) setCompetitorsAll(false);
    setSelectedCompetitors(vals);
  };
  const handleSetSelectedLocations = (vals: string[]) => {
    if (vals.length > 0 && locationsAll) setLocationsAll(false);
    setSelectedLocations(vals);
  };
  const handleSetSelectedDimensions = (vals: string[]) => {
    if (vals.length > 0 && dimensionsAll) setDimensionsAll(false);
    setSelectedDimensions(vals);
  };
  const handleSetSelectedUnitCategories = (vals: string[]) => {
    if (vals.length > 0 && unitCategoriesAll) setUnitCategoriesAll(false);
    setSelectedUnitCategories(vals);
  };

  /* ---------------- Build calcFilters: IMPORTANT —
     When user selected "All" we expand it INTO an explicit subset containing
     only values that actually appear in the competitor dataset. This prevents
     generating combinations for UI-only values. --------------------------- */
  const calcFilters = useMemo<CalcFiltersShape>(() => {
    const competitorsVals = competitorsAll
      ? deriveValuesForKey("competitors")
      : selectedCompetitors;
    const locationsVals = locationsAll
      ? deriveValuesForKey("locations")
      : selectedLocations;
    const dimensionsVals = dimensionsAll
      ? deriveValuesForKey("dimensions")
      : selectedDimensions;
    const unitCatsVals = unitCategoriesAll
      ? deriveValuesForKey("unit_categories")
      : selectedUnitCategories;

    return {
      competitors:
        competitorsAll || competitorsVals.length === 0
          ? { mode: "subset", values: competitorsVals }
          : { mode: "subset", values: competitorsVals },
      locations:
        locationsAll || locationsVals.length === 0
          ? { mode: "subset", values: locationsVals }
          : { mode: "subset", values: locationsVals },
      dimensions:
        dimensionsAll || dimensionsVals.length === 0
          ? { mode: "subset", values: dimensionsVals }
          : { mode: "subset", values: dimensionsVals },
      unit_categories:
        unitCategoriesAll || unitCatsVals.length === 0
          ? { mode: "subset", values: unitCatsVals }
          : { mode: "subset", values: unitCatsVals },
    };
  }, [
    competitorsAll,
    locationsAll,
    dimensionsAll,
    unitCategoriesAll,
    selectedCompetitors,
    selectedLocations,
    selectedDimensions,
    selectedUnitCategories,
    // deriveValuesForKey covers its closure deps
    deriveValuesForKey,
  ]);

  // Merge calcFilters (the classic four) with any universal filters the user added.
  const mergedFilters = useMemo(() => {
    const base: Record<string, { mode: 'all' } | { mode: 'subset'; values: string[] }> = {
      competitors: calcFilters.competitors,
      locations: calcFilters.locations,
      dimensions: calcFilters.dimensions,
      unit_categories: calcFilters.unit_categories,
    };
    for (const [k, vals] of Object.entries(universalFilters)) {
      if (!vals || vals.length === 0) continue
      base[k] = { mode: 'subset', values: vals }
    }
    return base
  }, [calcFilters, universalFilters])

  const mergedCombinatoricFlags = useMemo(() => {
    return {
      competitors: competitorsCombinatoric,
      locations: locationsCombinatoric,
      dimensions: dimensionsCombinatoric,
      unit_categories: unitCategoriesCombinatoric,
      ...universalCombinatoric,
    }
  }, [competitorsCombinatoric, locationsCombinatoric, dimensionsCombinatoric, unitCategoriesCombinatoric, universalCombinatoric])

  /* ---------------- availableFilterValues (used if some other component needs "UI options") ---------------- */
  const availableFilterValues = useMemo<
    Record<keyof CalcFiltersShape, string[]>
  >(() => {
    return {
      competitors: allCompetitors ?? [],
      locations: allLocations ?? [],
      dimensions: allDimensions ?? [],
      unit_categories: allUnitCategories ?? [],
    };
  }, [allCompetitors, allLocations, allDimensions, allUnitCategories]);

  /* ---------------- Render ---------------- */
  return (
    <main className="mx-auto max-w-7xl p-6 space-y-5">
      <ContextChips
        chips={createChips({
          label: "Pricing Pipelines",
          isCurrent: true,
        })}
      />
      <header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">
              Build pricing strategies with Filters, and Competitive,
              Function-based, and Temporal Adjusters
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PipelineSelector
              currentFilters={{
                competitors: selectedCompetitors,
                locations: selectedLocations,
                dimensions: selectedDimensions,
                unit_categories: selectedUnitCategories,
              }}
              currentAdjusters={localAdjusters}
              onLoadPipeline={handleLoadPipeline}
              onPipelineChange={handlePipelineChange}
            />
          </div>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <PricingOverview
        selectedSnapshot={selectedSnapshot}
        snapshots={snapshots}
        dataResponse={dataResponse}
        columnsStats={columnsStats}
        onSnapshotChange={setSelectedSnapshot}
      />

      <PricingFilters
        rows={dataResponse?.data ?? []}
        visibleColumns={visibleColumns}
        selectedFilters={universalFilters}
        setSelectedFilters={setUniversalFilters}
        combinatoricFlags={universalCombinatoric}
        setCombinatoricFlags={setUniversalCombinatoric}
      />

      {/* Price Calculation Section */}
      <div className="space-y-4">
        <SectionLabel
          text="Price Calculation"
          right={
            <div className="text-xs text-muted-foreground">
              {priceDiagnostics.pricesFound}/{priceDiagnostics.competitorRows}{" "}
              units with prices
            </div>
          }
        />

        {!loading && !canAddAdjusters && (
          <PriceDataWarning competitorData={fullyFilteredRows} />
        )}

        {pipelineNeedsBase && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTitle>Competitive step required</AlertTitle>
            <AlertDescription>
              Step 1 must be a competitive adjuster to establish the base price.
              Remove or re-add cards until a competitive card leads the
              pipeline.
            </AlertDescription>
          </Alert>
        )}

        <AdjustersList
          adjusters={localAdjusters}
          actions={
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Plus className="h-3.5 w-3.5" /> Add adjuster
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={!canAddAdjusters}
                onClick={competitiveDialog.handleOpen}
                className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 disabled:opacity-50"
                title={
                  !canAddAdjusters
                    ? "Add competitor data with prices to enable adjusters"
                    : undefined
                }
              >
                <TrendingDown className="h-4 w-4 mr-1.5" />
                Competitive
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!canAddNonCompetitiveAdjusters}
                onClick={functionDialog.handleOpen}
                className="border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800 disabled:opacity-50"
              >
                <Calculator className="h-4 w-4 mr-1.5" />
                Function
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!canAddNonCompetitiveAdjusters}
                onClick={temporalDialog.handleOpen}
                className="border-violet-200 text-violet-700 hover:bg-violet-50 hover:text-violet-800 disabled:opacity-50"
              >
                <Clock className="h-4 w-4 mr-1.5" />
                Temporal
              </Button>
            </div>
          }
          onRemoveAdjuster={handleRemoveAdjuster}
        />

        <div className="min-h-0 flex-1">

          <CalculatedPrice
            competitorData={fullyFilteredRows}
            clientAvailableUnits={clientDataResponse?.data.length || 0}
            adjusters={localAdjusters}
            currentDate={currentDate}
            filters={mergedFilters}
            availableFilterValues={availableFilterValues}
            combinatoricFlags={mergedCombinatoricFlags}
          />
        </div>

        <AddCompetitiveAdjusterDialog
          open={competitiveDialog.open}
          onOpenChange={competitiveDialog.setOpen}
          onAdd={handleAddAdjuster}
        />
        <AddFunctionAdjusterDialog
          open={functionDialog.open}
          onOpenChange={functionDialog.setOpen}
          onAdd={handleAddAdjuster}
          availableVariables={availableVariables}
          competitorData={fullyFilteredRows}
          clientAvailableUnits={clientDataResponse?.data.length || 0}
        />
        <AddTemporalAdjusterDialog
          open={temporalDialog.open}
          onOpenChange={temporalDialog.setOpen}
          onAdd={handleAddAdjuster}
        />
      </div>
    </main>
  );
}
