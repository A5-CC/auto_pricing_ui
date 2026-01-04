"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  getE1Snapshots,
  getE1Competitors,
  getE1Client,
} from "@/lib/api/client/pipelines";

import type { E1Snapshot, E1DataResponse, PipelineFilters as PipelineFiltersType, Pipeline } from "@/lib/api/types";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SectionLabel } from "@/components/ui/section-label";

import { PricingOverview } from "../pricing/components/pricing-overview";
import { PricingFilters } from "../pricing/components/pricing-filters";

import { AdjustersList } from "@/components/pipelines/adjusters-list";
import { CalculatedPrice } from "@/components/pipelines/calculated-price";

import {
  AddCompetitiveAdjusterDialog,
} from "@/components/pipelines/adjusters/add-competitive-adjuster-dialog";
import {
  AddFunctionAdjusterDialog,
} from "@/components/pipelines/adjusters/add-function-adjuster-dialog";
import {
  AddTemporalAdjusterDialog,
} from "@/components/pipelines/adjusters/add-temporal-adjuster-dialog";

import { useAdjusterDialog } from "@/components/pipelines/adjusters/use-adjuster-dialog";
import { PriceDataWarning } from "@/components/pipelines/price-data-warning";

import type { Adjuster } from "@/lib/adjusters";
import { hasValidCompetitorPrices, getPriceDiagnostics } from "@/lib/adjusters";

import { Calculator, Clock, TrendingDown } from "lucide-react";

// 🔥 NEW: import PipelineSelector
import { PipelineSelector } from "@/components/pipelines/pipeline-selector";

/* ---------------- Types ---------------- */

type CalcFilter =
  | { mode: "all" }
  | { mode: "subset"; values: string[] };

type CalcFiltersShape = {
  competitors: CalcFilter;
  locations: CalcFilter;
  dimensions: CalcFilter;
  unit_categories: CalcFilter;
};

/* ---------------- Page ---------------- */

export default function PipelinesPage() {
  const [snapshots, setSnapshots] = useState<E1Snapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState("latest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dataResponse, setDataResponse] = useState<E1DataResponse | null>(null);
  const [clientDataResponse, setClientDataResponse] =
    useState<E1DataResponse | null>(null);

  const [localAdjusters, setLocalAdjusters] = useState<Adjuster[]>([]);

  /* -------- Filters -------- */

  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>([]);
  const [selectedUnitCategories, setSelectedUnitCategories] = useState<string[]>(
    []
  );

  const [competitorsAll] = useState(false);
  const [locationsAll] = useState(false);
  const [dimensionsAll] = useState(false);
  const [unitCategoriesAll] = useState(false);

  /* -------- Dialogs -------- */

  const competitiveDialog = useAdjusterDialog();
  const functionDialog = useAdjusterDialog();
  const temporalDialog = useAdjusterDialog();

  /* -------- Load snapshots -------- */

  useEffect(() => {
    getE1Snapshots().then(setSnapshots).catch(() => {});
  }, []);

  /* -------- Load data -------- */

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const competitors = await getE1Competitors(selectedSnapshot, {
        limit: 10000,
      });
      const client = await getE1Client(selectedSnapshot, { limit: 10000 });

      setDataResponse(competitors);
      setClientDataResponse(client);
    } catch {
      setError("Failed to load pricing data");
    } finally {
      setLoading(false);
    }
  }, [selectedSnapshot]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* -------- Derived data (memoized) -------- */

  const competitorRows = useMemo(
    () => dataResponse?.data ?? [],
    [dataResponse]
  );

  const currentDate = useMemo(() => new Date(), []);

  const canAddAdjusters = useMemo(
    () => hasValidCompetitorPrices(competitorRows),
    [competitorRows]
  );

  const priceDiagnostics = useMemo(
    () => getPriceDiagnostics(competitorRows),
    [competitorRows]
  );

  /* -------- Adjusters -------- */

  const handleAddAdjuster = (adjuster: Adjuster) => {
    setLocalAdjusters((prev) => [...prev, adjuster]);
  };

  const handleRemoveAdjuster = (index: number) => {
    const next = localAdjusters.filter((_, i) => i !== index);

    if (next.length && next[0].type !== "competitive") {
      toast.warning(
        "The pipeline must start with a Competitive adjuster."
      );
      return;
    }
    setLocalAdjusters(next);
  };

  /* -------- NEW: pipeline handlers -------- */

  const handleLoadPipeline = (filters: PipelineFiltersType) => {
    setSelectedCompetitors(filters.competitors);
    setSelectedLocations(filters.locations);
    setSelectedDimensions(filters.dimensions);
    setSelectedUnitCategories(filters.unit_categories);
  };

  const handlePipelineChange = (pipeline: Pipeline | null) => {
    setLocalAdjusters(pipeline?.adjusters || []);
  };

  /* -------- Filters for calculation -------- */

  const calcFilters = useMemo<CalcFiltersShape>(
    () => ({
      competitors: competitorsAll
        ? { mode: "all" }
        : { mode: "subset", values: selectedCompetitors },
      locations: locationsAll
        ? { mode: "all" }
        : { mode: "subset", values: selectedLocations },
      dimensions: dimensionsAll
        ? { mode: "all" }
        : { mode: "subset", values: selectedDimensions },
      unit_categories: unitCategoriesAll
        ? { mode: "all" }
        : { mode: "subset", values: selectedUnitCategories },
    }),
    [
      competitorsAll,
      locationsAll,
      dimensionsAll,
      unitCategoriesAll,
      selectedCompetitors,
      selectedLocations,
      selectedDimensions,
      selectedUnitCategories,
    ]
  );

  /* ---------------- Render ---------------- */

  return (
    <main className="mx-auto max-w-7xl p-6 space-y-6">
      <header className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Build pricing pipelines using competitive, functional, and temporal
          adjusters.
        </p>

        {/* ---------------- NEW: PipelineSelector + Export ---------------- */}
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

          <Button variant="outline" size="sm" disabled>
            Export CSV
          </Button>
        </div>
        {/* ---------------- END NEW ---------------- */}
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
        columnsStats={{}}
        onSnapshotChange={setSelectedSnapshot}
      />

      <PricingFilters
        selectedCompetitors={selectedCompetitors}
        setSelectedCompetitors={setSelectedCompetitors}
        allCompetitors={[]}
        selectedLocations={selectedLocations}
        setSelectedLocations={setSelectedLocations}
        allLocations={[]}
        selectedDimensions={selectedDimensions}
        setSelectedDimensions={setSelectedDimensions}
        allDimensions={[]}
        selectedUnitCategories={selectedUnitCategories}
        setSelectedUnitCategories={setSelectedUnitCategories}
        allUnitCategories={[]}
      />

      <SectionLabel
        text="Price Calculation"
        right={
          <span className="text-xs text-muted-foreground">
            {priceDiagnostics.pricesFound}/{priceDiagnostics.competitorRows} units
            with prices
          </span>
        }
      />

      {!loading && !canAddAdjusters && (
        <PriceDataWarning competitorData={competitorRows} />
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
              title={!canAddAdjusters ? "Add competitor data with prices to enable adjusters" : undefined}
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
              title={
                !canAddNonCompetitiveAdjusters
                  ? !canAddAdjusters
                    ? "Add competitor data with prices to enable adjusters"
                    : !hasCompetitiveAdjuster
                      ? "Add a competitive adjuster first to set the base price"
                      : "Step 1 must remain competitive"
                  : undefined
              }
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
              title={
                !canAddNonCompetitiveAdjusters
                  ? !canAddAdjusters
                    ? "Add competitor data with prices to enable adjusters"
                    : !hasCompetitiveAdjuster
                      ? "Add a competitive adjuster first to set the base price"
                      : "Step 1 must remain competitive"
                  : undefined
              }
            >
              <Clock className="h-4 w-4 mr-1.5" />
              Temporal
            </Button>
          </div>
        }
        onRemoveAdjuster={handleRemoveAdjuster}
      />

      <CalculatedPrice
        variant="inline"
        competitorData={competitorRows}
        clientAvailableUnits={clientDataResponse?.data.length || 0}
        adjusters={localAdjusters}
        currentDate={currentDate}
        filters={calcFilters}
        maxCombinations={50}
      />

      <AddCompetitiveAdjusterDialog
        open={competitiveDialog.open}
        onOpenChange={competitiveDialog.setOpen}
        onAdd={handleAddAdjuster}
      />

      <AddFunctionAdjusterDialog
        open={functionDialog.open}
        onOpenChange={functionDialog.setOpen}
        onAdd={handleAddAdjuster}
        competitorData={competitorRows}
        clientAvailableUnits={clientDataResponse?.data.length || 0}
        availableVariables={[]}
      />

      <AddTemporalAdjusterDialog
        open={temporalDialog.open}
        onOpenChange={temporalDialog.setOpen}
        onAdd={handleAddAdjuster}
      />
    </main>
  );
}
