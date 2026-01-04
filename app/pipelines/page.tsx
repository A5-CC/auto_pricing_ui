"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getE1Snapshots,
  getE1Competitors,
  getE1Client,
  exportE1CompetitorsCSV,
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
import { useCompetitorFilter } from "@/hooks/useCompetitorFilter";
import { useLocationFilter } from "@/hooks/useLocationFilter";
import { useDimensionsFilter } from "@/hooks/useDimensionsFilter";
import { useUnitCategoryFilter } from "@/hooks/useUnitCategoryFilter";
import { SectionLabel } from "@/components/ui/section-label";
import { PricingOverview } from "../pricing/components/pricing-overview";
import { PricingFilters } from "../pricing/components/pricing-filters";
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
 * Filter shape passed to CalculatedPrice
 */
type CalcFilter = { mode: "all" } | { mode: "subset"; values: string[] };
type CalcFiltersShape = {
  competitors: CalcFilter;
  locations: CalcFilter;
  dimensions: CalcFilter;
  unit_categories: CalcFilter;
};

export default function PipelinesPage() {
  const { createChips } = useContextChips();

  const [snapshots, setSnapshots] = useState<E1Snapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string>("latest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [localAdjusters, setLocalAdjusters] = useState<Adjuster[]>([]);

  const competitiveDialog = useAdjusterDialog();
  const functionDialog = useAdjusterDialog();
  const temporalDialog = useAdjusterDialog();

  // Filters
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>([]);
  const [selectedUnitCategories, setSelectedUnitCategories] = useState<string[]>([]);

  const [competitorsAll, setCompetitorsAll] = useState(false);
  const [locationsAll, setLocationsAll] = useState(false);
  const [dimensionsAll, setDimensionsAll] = useState(false);
  const [unitCategoriesAll, setUnitCategoriesAll] = useState(false);

  const [dataResponse, setDataResponse] = useState<E1DataResponse | null>(null);
  const [clientDataResponse, setClientDataResponse] = useState<E1DataResponse | null>(null);
  const [columnsStats, setColumnsStats] = useState<Record<string, ColumnStatistics>>({});

  // Filter pipeline
  const { filteredRows: competitorFilteredRows, allCompetitors } =
    useCompetitorFilter(dataResponse?.data ?? [], selectedCompetitors);

  const { filteredRows, allLocations } =
    useLocationFilter(competitorFilteredRows, selectedLocations);

  const { filteredRows: locationAndDimFilteredRows, allDimensions } =
    useDimensionsFilter(filteredRows, selectedDimensions);

  const { filteredRows: fullyFilteredRows, allUnitCategories } =
    useUnitCategoryFilter(locationAndDimFilteredRows, selectedUnitCategories);

  // Load snapshots
  useEffect(() => {
    getE1Snapshots().then(setSnapshots).catch(() => {});
  }, []);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getE1Competitors(selectedSnapshot, { limit: 10000 });
      setDataResponse(res);

      const clientRes = await getE1Client(selectedSnapshot, { limit: 10000 });
      setClientDataResponse(clientRes);

      if (res.columns?.length) {
        const stats = await getE1CompetitorsStatistics(selectedSnapshot, res.columns);
        setColumnsStats(Object.fromEntries(stats.map(s => [s.column, s])));
      }
    } catch {
      setError("Failed to load pricing data");
    } finally {
      setLoading(false);
    }
  }, [selectedSnapshot]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onExport = async () => {
    if (!selectedSnapshot) return;
    const blob = await exportE1CompetitorsCSV(selectedSnapshot, {});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `e1-competitors-${selectedSnapshot}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadPipeline = (filters: PipelineFiltersType) => {
    setSelectedCompetitors(filters.competitors);
    setSelectedLocations(filters.locations);
    setSelectedDimensions(filters.dimensions);
    setSelectedUnitCategories(filters.unit_categories);
  };

  const handlePipelineChange = (pipeline: Pipeline | null) => {
    setLocalAdjusters(pipeline?.adjusters || []);
  };

  const handleAddAdjuster = (adjuster: Adjuster) => {
    setLocalAdjusters(prev => [...prev, adjuster]);
  };

  const handleRemoveAdjuster = (index: number) => {
    const next = localAdjusters.filter((_, i) => i !== index);
    if (next.length && next[0].type !== "competitive") {
      toast.warning("Pipeline must start with a Competitive adjuster");
      return;
    }
    setLocalAdjusters(next);
  };

  const currentDate = useMemo(() => new Date(), []);

  const canAddAdjusters = useMemo(
    () => hasValidCompetitorPrices(fullyFilteredRows),
    [fullyFilteredRows]
  );

  const priceDiagnostics = useMemo(
    () => getPriceDiagnostics(fullyFilteredRows),
    [fullyFilteredRows]
  );

  const calcFilters = useMemo<CalcFiltersShape>(() => ({
    competitors: competitorsAll ? { mode: "all" } : { mode: "subset", values: selectedCompetitors },
    locations: locationsAll ? { mode: "all" } : { mode: "subset", values: selectedLocations },
    dimensions: dimensionsAll ? { mode: "all" } : { mode: "subset", values: selectedDimensions },
    unit_categories: unitCategoriesAll ? { mode: "all" } : { mode: "subset", values: selectedUnitCategories },
  }), [
    competitorsAll,
    locationsAll,
    dimensionsAll,
    unitCategoriesAll,
    selectedCompetitors,
    selectedLocations,
    selectedDimensions,
    selectedUnitCategories,
  ]);

  const availableFilterValues = {
    competitors: allCompetitors ?? [],
    locations: allLocations ?? [],
    dimensions: allDimensions ?? [],
    unit_categories: allUnitCategories ?? [],
  };

  return (
    <main className="mx-auto max-w-7xl p-6 space-y-5">
      <ContextChips
        chips={createChips({ label: "Pricing Pipelines", isCurrent: true })}
      />

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
        selectedCompetitors={selectedCompetitors}
        setSelectedCompetitors={setSelectedCompetitors}
        allCompetitors={allCompetitors}
        selectedLocations={selectedLocations}
        setSelectedLocations={setSelectedLocations}
        allLocations={allLocations}
        selectedDimensions={selectedDimensions}
        setSelectedDimensions={setSelectedDimensions}
        allDimensions={allDimensions}
        selectedUnitCategories={selectedUnitCategories}
        setSelectedUnitCategories={setSelectedUnitCategories}
        allUnitCategories={allUnitCategories}
      />

      <SectionLabel
        text="Price Calculation"
        right={
          <div className="text-xs text-muted-foreground">
            {priceDiagnostics.pricesFound}/{priceDiagnostics.competitorRows} units with prices
          </div>
        }
      />

      {!loading && !canAddAdjusters && (
        <PriceDataWarning competitorData={fullyFilteredRows} />
      )}

      <AdjustersList
        adjusters={localAdjusters}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={competitiveDialog.handleOpen}>
              <TrendingDown className="h-4 w-4 mr-1.5" /> Competitive
            </Button>
            <Button size="sm" variant="outline" onClick={functionDialog.handleOpen}>
              <Calculator className="h-4 w-4 mr-1.5" /> Function
            </Button>
            <Button size="sm" variant="outline" onClick={temporalDialog.handleOpen}>
              <Clock className="h-4 w-4 mr-1.5" /> Temporal
            </Button>
          </div>
        }
        onRemoveAdjuster={handleRemoveAdjuster}
      />

      <CalculatedPrice
        variant="inline"
        competitorData={fullyFilteredRows}
        clientAvailableUnits={clientDataResponse?.data.length || 0}
        adjusters={localAdjusters}
        currentDate={currentDate}
        filters={calcFilters}
        availableFilterValues={availableFilterValues}
        maxCombinations={50}
      />

      <AddCompetitiveAdjusterDialog {...competitiveDialog} onAdd={handleAddAdjuster} />
      <AddFunctionAdjusterDialog
        {...functionDialog}
        onAdd={handleAddAdjuster}
        competitorData={fullyFilteredRows}
        clientAvailableUnits={clientDataResponse?.data.length || 0}
        availableVariables={[]}
      />
      <AddTemporalAdjusterDialog {...temporalDialog} onAdd={handleAddAdjuster} />
    </main>
  );
}