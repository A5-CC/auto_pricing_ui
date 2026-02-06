"use client";

import { ContextChips } from "@/components/context-chips";
import { AdjustersList } from "@/components/pipelines/adjusters-list";
import { AddCompetitiveAdjusterDialog } from "@/components/pipelines/adjusters/add-competitive-adjuster-dialog";
import { AddFunctionAdjusterDialog } from "@/components/pipelines/adjusters/add-function-adjuster-dialog";
import { AddTemporalAdjusterDialog } from "@/components/pipelines/adjusters/add-temporal-adjuster-dialog";
import { useAdjusterDialog } from "@/components/pipelines/adjusters/use-adjuster-dialog";
import { CalculatedPrice } from "@/components/pipelines/calculated-price";
import { PipelineBuilderChatbot } from "@/components/pipelines/pipeline-builder-chatbot";
import { PipelineSelector } from "@/components/pipelines/pipeline-selector";
import { PriceDataWarning } from "@/components/pipelines/price-data-warning";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { useContextChips } from "@/hooks/useContextChips";
import type { Adjuster } from "@/lib/adjusters";
import { getPriceDiagnostics, hasValidCompetitorPrices } from "@/lib/adjusters";
import {
  getE1Client,
} from "@/lib/api/client/pipelines";
import { getColumnStatistics, getPricingData, getPricingSchemas, getPricingSnapshots } from "@/lib/api/client/pricing";
import type {
  ColumnStatistics,
  Pipeline,
  PipelineFilters as PipelineFiltersType,
  PricingDataResponse,
  PricingSchemas,
  PricingSnapshot,
} from "@/lib/api/types";
import { Calculator, Clock, Plus, TrendingDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { UniversalPipelineFilters } from "../pipelines/components/universal-pipeline-filters";
import { PricingOverview } from "../pricing/components/pricing-overview";

export default function PipelinesPage() {
  /* ---------------- State ---------------- */
  const [snapshots, setSnapshots] = useState<PricingSnapshot[]>([]);
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

  // Universal pipeline filters (column -> values)
  const [universalFilters, setUniversalFilters] = useState<Record<string, string[]>>({});
  const [universalCombinatoric, setUniversalCombinatoric] = useState<Record<string, boolean>>({});
  const [pricingSchemas, setPricingSchemas] = useState<PricingSchemas | null>(null);

  // data
  const [dataResponse, setDataResponse] = useState<PricingDataResponse | null>(
    null
  );
  const [clientDataResponse, setClientDataResponse] =
    useState<PricingDataResponse | null>(null);

  // column statistics & visible columns
  const [columnsStats, setColumnsStats] = useState<
    Record<string, ColumnStatistics>
  >({});

  // Mirror /pricing: keep an unfiltered snapshot in memory and filter client-side.
  const baseRows = useMemo(() => dataResponse?.data ?? [], [dataResponse]);

  const { createChips } = useContextChips();

  /* ---------------- Data loading ---------------- */
  const loadSnapshots = async () => {
    try {
      const s = await getPricingSnapshots();
      setSnapshots(s);
    } catch {
      /* ignore */
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Mirror /pricing: fetch pricing-data snapshot and do all filtering client-side.
      const res = await getPricingData(selectedSnapshot, { limit: 1000 });
      setDataResponse(res);

      // Best-effort: client (modSTORAGE) data lives under the E1 client endpoint.
      // If it fails for a given snapshot, continue without it.
      try {
        const clientRes = await getE1Client(selectedSnapshot, { limit: 1000 });
        setClientDataResponse(clientRes as unknown as PricingDataResponse);
      } catch {
        setClientDataResponse(null);
      }

      if (res.columns?.length) {
        const stats = await getColumnStatistics(selectedSnapshot, res.columns);
        const byName = Object.fromEntries(stats.map((s) => [s.column, s]));
        setColumnsStats(byName);
      }
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "Failed to load pricing data";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [selectedSnapshot]);

  useEffect(() => {
    loadSnapshots();
    loadData(); // initial load
    (async () => {
      try {
        const schemas = await getPricingSchemas();
        setPricingSchemas(schemas);
      } catch {
        // ignore
      }
    })();
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [selectedSnapshot, loadData]);

  /* ---------------- Pipeline load/save handlers ---------------- */
  const handleLoadPipeline = (filters: PipelineFiltersType) => {
    // Start-over behavior: treat pipeline filters as universal (pricing-style) column filters.
    // This keeps filtering aligned with the pricing dataset columns.
    const nextUniversal: Record<string, string[]> = { ...universalFilters }
    if (Array.isArray(filters.competitors) && filters.competitors.length > 0) {
      nextUniversal['competitor_name'] = filters.competitors
    }
    if (Array.isArray(filters.locations) && filters.locations.length > 0) {
      nextUniversal['modstorage_location'] = filters.locations
    }
    if (Array.isArray(filters.dimensions) && filters.dimensions.length > 0) {
      nextUniversal['unit_dimensions'] = filters.dimensions
    }
    if (Array.isArray(filters.unit_categories) && filters.unit_categories.length > 0) {
      nextUniversal['unit_category'] = filters.unit_categories
    }
    setUniversalFilters(nextUniversal)

    // Clear legacy filter state so it cannot create accidental combinatoric combinations.
    setSelectedCompetitors([])
    setSelectedLocations([])
    setSelectedDimensions([])
    setSelectedUnitCategories([])
  };

  const handlePipelineChange = (pipeline: Pipeline | null) => {
    setLocalAdjusters(pipeline?.adjusters || []);
  };

  /* ---------------- Adjuster actions ---------------- */
  const handleAddAdjuster = (adjuster: Adjuster) => {
    setLocalAdjusters((prev: typeof localAdjusters) => [...prev, adjuster]);
  };

  const handleRemoveAdjuster = (index: number) => {
    const nextAdjusters = localAdjusters.filter((_: unknown, idx: number) => idx !== index);

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
        const dtype = (stats as { data_type: string }).data_type.toLowerCase();
        return dtype.includes("int") || dtype.includes("float");
      })
      .map(([col]) => col)
      .sort();

    return numericCols;
  }, [columnsStats]);

  /* ---------------- Note ----------------
     Unlike the legacy pipelines page, we do not maintain a separate sortable/grid view.
     We keep the full dataset in memory (like /pricing) and apply filters only where needed
     for calculation/adjusters.
  ---------------- */

  // Legacy calcFilters/combinatoric state removed in favor of universal (pricing-style) filters.


  // Universal filters behave like /pricing: the stored key is the column key.


  // --- Universal filter logic: split filters into subset and combinatoric ---
  type FilterMode = { mode: 'all' } | { mode: 'subset'; values: string[] }
  const allFilters = useMemo<Record<string, FilterMode>>(() => {
    const base: Record<string, FilterMode> = {}
    for (const [k, vals] of Object.entries(universalFilters)) {
      if (!Array.isArray(vals) || vals.length === 0) continue
      base[k] = { mode: 'subset', values: vals }
    }
    return base
  }, [universalFilters])

  const allCombinatoricFlags = useMemo<Record<string, boolean>>(() => {
    return { ...universalCombinatoric }
  }, [universalCombinatoric])

  // Split filters into subset and combinatoric
  const subsetFilters = useMemo<Record<string, string[]>>(() => {
    return Object.entries(allFilters)
      .filter(([k]) => !allCombinatoricFlags[k])
      .reduce((acc, [k]) => {
        const filter = allFilters[k] as FilterMode
        if (filter.mode === 'subset' && Array.isArray(filter.values) && filter.values.length > 0) {
          acc[k] = filter.values
        }
        return acc
      }, {} as Record<string, string[]>)
  }, [allFilters, allCombinatoricFlags])
  
  // Apply universal subset filters on top of the classic filtered dataset
  const subsetFilteredRows = useMemo(() => {
    let rows = (baseRows ?? []) as { [key: string]: unknown }[]

    const FILTER_KEY_TO_COLUMN: Record<string, string> = {
      competitors: 'competitor_name',
      locations: 'modstorage_location',
      dimensions: 'unit_dimensions',
      unit_categories: 'unit_category',
    }

    for (const [col, vals] of Object.entries(subsetFilters)) {
      if (!Array.isArray(vals) || vals.length === 0) continue

      const resolvedColumn = FILTER_KEY_TO_COLUMN[col] ?? col
      const sel = new Set(vals.map((v) => String(v)))
      rows = rows.filter((r) => {
        const v = r[resolvedColumn]
        if (v === null || v === undefined) return false
        if (Array.isArray(v)) return (v as unknown[]).some((x) => sel.has(String(x)))
        return sel.has(String(v))
      })
    }
    return rows as unknown as PricingDataResponse["data"]
  }, [baseRows, subsetFilters])

  // Combinatoric filters: only those with values in the filtered dataset
  const combinatoricFilters = useMemo<Record<string, { mode: 'subset'; values: string[] }>>(() => {
    return Object.entries(allFilters)
      .filter(([k, v]) => {
        const filter = v as FilterMode
        return allCombinatoricFlags[k] && filter.mode === 'subset' && Array.isArray((filter as { mode: 'subset'; values: string[] }).values) && (filter as { mode: 'subset'; values: string[] }).values.length > 0
      })
      .reduce((acc, [k]) => {
        const filter = allFilters[k] as { mode: 'subset'; values: string[] }

        const FILTER_KEY_TO_COLUMN: Record<string, string> = {
          competitors: 'competitor_name',
          locations: 'modstorage_location',
          dimensions: 'unit_dimensions',
          unit_categories: 'unit_category',
        }

        const resolvedColumn = FILTER_KEY_TO_COLUMN[k] ?? k
        // Only keep values that exist in the filtered dataset
        const present = Array.from(
          new Set(
            subsetFilteredRows.map(
              (r: { [key: string]: unknown }) => r[resolvedColumn]
            )
          )
        ).filter((x) => filter.values.includes(String(x)))
        if (present.length > 0) {
          acc[k] = { mode: 'subset', values: present.map(String) }
        }
        return acc
      }, {} as Record<string, { mode: 'subset'; values: string[] }>)
  }, [allFilters, allCombinatoricFlags, subsetFilteredRows])

  // Pass these to CalculatedPrice
  const mergedFilters = useMemo<Record<string, { mode: 'subset'; values: string[] }>>(() => {
    return {
      ...Object.entries(subsetFilters).reduce((acc, [k, vals]) => {
        acc[k] = { mode: 'subset', values: vals as string[] }
        return acc
      }, {} as Record<string, { mode: 'subset'; values: string[] }>),
      ...combinatoricFilters,
    }
  }, [subsetFilters, combinatoricFilters])

  const mergedCombinatoricFlags = useMemo<Record<string, boolean>>(() => {
    return Object.fromEntries(Object.keys(combinatoricFilters).map((k: string) => [k, true]))
  }, [combinatoricFilters])

  /* ---------------- Current date + diagnostics ---------------- */
  const currentDate = useMemo(() => new Date(), []);
  const canAddAdjusters = useMemo(
    () => hasValidCompetitorPrices(subsetFilteredRows),
    [subsetFilteredRows]
  );

  const hasCompetitiveAdjuster = localAdjusters.some(
    (adj: { type: string }) => adj.type === "competitive"
  );
  const firstAdjusterIsCompetitive =
    localAdjusters.length === 0 || localAdjusters[0].type === "competitive";
  const pipelineNeedsBase =
    localAdjusters.length > 0 && !firstAdjusterIsCompetitive;
  const canAddNonCompetitiveAdjusters =
    canAddAdjusters && hasCompetitiveAdjuster && firstAdjusterIsCompetitive;

  const priceDiagnostics = useMemo(
    () => getPriceDiagnostics(subsetFilteredRows),
    [subsetFilteredRows]
  );

  const hasActiveFilterSelections = useMemo(() => {
    // Only consider filters “active” when they have selected values.
    return Object.values(universalFilters).some((vals) => Array.isArray(vals) && vals.length > 0)
  }, [universalFilters])

  // Check isDev only on client-side to avoid hydration mismatch
  const [isDev, setIsDev] = useState(false)
  useEffect(() => {
    setIsDev(process.env.NODE_ENV === 'development')
  }, [])

  // Small dev debug: counts and sample rows to help diagnose missing competitor data
  const devDebug = useMemo(() => {
    try {
      const total = (dataResponse?.data ?? []).length
      const competitorRows = (dataResponse?.data ?? []).filter((r) => String((r as { competitor_name?: unknown }).competitor_name) !== 'modSTORAGE')
      const competitorCount = competitorRows.length
      const clientCount = (clientDataResponse?.data ?? []).length
      const sample = (dataResponse?.data ?? []).slice(0, 3)
      return { total, competitorCount, clientCount, sample }
    } catch {
      return null
    }
  }, [dataResponse, clientDataResponse])

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

      {/* Universal Filters Section - marked for chatbot navigation */}
      <div data-section="universal-filters">
        <UniversalPipelineFilters
          rows={dataResponse?.data ?? []}
          pricingSchemas={pricingSchemas}
          selectedFilters={universalFilters}
          setSelectedFilters={setUniversalFilters}
          combinatoricFlags={universalCombinatoric}
          setCombinatoricFlags={setUniversalCombinatoric}
        />
      </div>

      {/* Price Calculation Section - marked for chatbot navigation */}
      <div className="space-y-4" data-section="price-calculation">
        <SectionLabel
          text="Price Calculation"
          right={
            <div className="text-xs text-muted-foreground">
              {priceDiagnostics.pricesFound}/{priceDiagnostics.competitorRows}{" "}
              units with prices
            </div>
          }
        />

        {isDev && devDebug && (
          <div className="text-xs text-muted-foreground">
            <details className="mb-2">
              <summary className="cursor-pointer">Dev dataset debug</summary>
              <div className="mt-2">
                <div>Total rows from competitors endpoint: {devDebug.total}</div>
                <div>Competitor rows (excluding modSTORAGE): {devDebug.competitorCount}</div>
                <div>Client rows from client endpoint: {devDebug.clientCount}</div>
                <div className="mt-2">Sample rows (first 3):
                  <pre className="text-[11px] p-2 bg-slate-50 rounded border mt-1 overflow-auto">{JSON.stringify(devDebug.sample, null, 2)}</pre>
                </div>
              </div>
            </details>
          </div>
        )}

        {!loading && hasActiveFilterSelections && !canAddAdjusters && (
          <PriceDataWarning competitorData={subsetFilteredRows} />
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
            competitorData={subsetFilteredRows}
            clientAvailableUnits={clientDataResponse?.data.length || 0}
            adjusters={localAdjusters}
            currentDate={currentDate}
            filters={mergedFilters}
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
          competitorData={subsetFilteredRows}
          clientAvailableUnits={clientDataResponse?.data.length || 0}
        />
        <AddTemporalAdjusterDialog
          open={temporalDialog.open}
          onOpenChange={temporalDialog.setOpen}
          onAdd={handleAddAdjuster}
        />
      </div>

      {/* AI Pipeline Builder Chatbot */}
      <PipelineBuilderChatbot
        availableColumns={Object.keys(columnsStats)}
      />
    </main>
  );
}
