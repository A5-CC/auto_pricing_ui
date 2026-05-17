"use client";

import { AdjustersList } from "@/components/pipelines/adjusters-list";
import { AddCompetitiveAdjusterDialog } from "@/components/pipelines/adjusters/add-competitive-adjuster-dialog";
import { AddFunctionAdjusterDialog } from "@/components/pipelines/adjusters/add-function-adjuster-dialog";
import { AddTemporalAdjusterDialog } from "@/components/pipelines/adjusters/add-temporal-adjuster-dialog";
import { useAdjusterDialog } from "@/components/pipelines/adjusters/use-adjuster-dialog";
import { CalculatedPrice, calculatePriceTable } from "@/components/pipelines/calculated-price";
import { PipelineSelector } from "@/components/pipelines/pipeline-selector";
import { PriceDataWarning } from "@/components/pipelines/price-data-warning";
import { ProcessCsvButton } from "@/components/pricing/process-csv-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SectionLabel } from "@/components/ui/section-label";
import type { Adjuster } from "@/lib/adjusters";
import { getPriceDiagnostics, hasValidCompetitorPrices } from "@/lib/adjusters";
import { getCachedValue } from "@/lib/api/cache";
import {
  getE1Client,
} from "@/lib/api/client/pipelines";
import { getColumnStatistics, getPricingData, getPricingSchemas, getPricingSnapshots } from "@/lib/api/client/pricing";
import type {
  ColumnStatistics,
  Pipeline,
  PricingDataResponse,
  PricingSchemas,
  PricingSnapshot,
} from "@/lib/api/types";
import { Calculator, Clock, Plus, TrendingDown, FileSpreadsheet } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { UniversalPipelineFilters } from "../pipelines/components/universal-pipeline-filters";
import { PricingOverview } from "../pricing/components/pricing-overview";

const INITIAL_LOAD_LIMIT = 250
const FULL_LOAD_LIMIT = 1000
const getPricingDataCacheKey = (snapshot: string, limit: number) =>
  `pricing-data-${snapshot}-limit=${limit}`
const getE1ClientCacheKey = (snapshot: string, limit: number) =>
  `e1-client-${snapshot}-limit=${limit}`

export default function PipelinesPage() {
  const LEGACY_TO_COLUMN: Record<string, string> = {
    competitors: 'competitor_name',
    locations: 'client_location',
    client_location: 'client_location',
    dimensions: 'unit_dimensions',
    unit_categories: 'unit_category',
  }

  const normalizeFilterKeys = (filters?: Record<string, string[]>) => {
    const next: Record<string, string[]> = {}
    for (const [key, vals] of Object.entries(filters ?? {})) {
      if (!Array.isArray(vals) || vals.length === 0) continue
      const resolvedKey = LEGACY_TO_COLUMN[key] ?? key
      next[resolvedKey] = vals
    }
    return next
  }

  const normalizeCombinatoricFlagKeys = (flags?: Record<string, boolean>) => {
    const next: Record<string, boolean> = {}
    for (const [key, value] of Object.entries(flags ?? {})) {
      const resolvedKey = LEGACY_TO_COLUMN[key] ?? key
      next[resolvedKey] = Boolean(value)
    }
    return next
  }

  const normalizeFilterModeKeys = (modes?: Record<string, string>) => {
    const next: Record<string, string> = {}
    for (const [key, value] of Object.entries(modes ?? {})) {
      const resolvedKey = LEGACY_TO_COLUMN[key] ?? key
      next[resolvedKey] = value
    }
    return next
  }

  /* ---------------- State ---------------- */
  const [snapshots, setSnapshots] = useState<PricingSnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string>("latest");
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localAdjusters, setLocalAdjusters] = useState<Adjuster[]>([]);
  const [roundingEnabled, setRoundingEnabled] = useState(false);
  const [roundingOffset, setRoundingOffset] = useState(0);
  const [roundingOffsetInput, setRoundingOffsetInput] = useState("0");
  
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
  const hasLoadedDataRef = useRef(false)
  const [clientDataResponse, setClientDataResponse] =
    useState<PricingDataResponse | null>(null);

  // column statistics & visible columns
  const [columnsStats, setColumnsStats] = useState<
    Record<string, ColumnStatistics>
  >({});
  const activeLoadRef = useRef(0)

  // Mirror /pricing: keep an unfiltered snapshot in memory and filter client-side.
  const baseRows = useMemo(() => dataResponse?.data ?? [], [dataResponse]);

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
    const loadId = ++activeLoadRef.current

    const cachedInitial = getCachedValue<PricingDataResponse>(
      getPricingDataCacheKey(selectedSnapshot, INITIAL_LOAD_LIMIT),
      { persist: true }
    )
    if (cachedInitial) {
      setDataResponse(cachedInitial)
      hasLoadedDataRef.current = true
    }

    const cachedClient = getCachedValue<PricingDataResponse>(
      getE1ClientCacheKey(selectedSnapshot, FULL_LOAD_LIMIT),
      { persist: true }
    )
    if (cachedClient) {
      setClientDataResponse(cachedClient)
    }

    setError(null);
    setColumnsStats({})

    // If we already have data (from a previous load or stale cache), show it
    // immediately and only show the refreshing banner.
    const alreadyHasData = hasLoadedDataRef.current || Boolean(cachedInitial)
    if (alreadyHasData) {
      setLoading(false)
      setIsRefreshing(true)
    } else {
      setLoading(true);
    }

    try {
      // Stage 1: quick initial payload for first paint.
      const initialRes = await getPricingData(selectedSnapshot, { limit: INITIAL_LOAD_LIMIT });
      if (loadId !== activeLoadRef.current) return
      setDataResponse(initialRes);
      hasLoadedDataRef.current = true
      setLoading(false);
      setIsRefreshing(false);

      // Stage 2a: hydrate full competitor data + stats in background.
      void (async () => {
        try {
          const fullRes = await getPricingData(selectedSnapshot, { limit: FULL_LOAD_LIMIT })
          if (loadId !== activeLoadRef.current) return
          setDataResponse(fullRes)

          if (fullRes.columns?.length) {
            const stats = await getColumnStatistics(selectedSnapshot, fullRes.columns)
            if (loadId !== activeLoadRef.current) return
            const byName = Object.fromEntries(stats.map((s) => [s.column, s]));
            setColumnsStats(byName)
          }
        } catch {
          // keep initial dataset visible
        }
      })()

      // Stage 2b: load client units in background (best-effort).
      void (async () => {
        try {
          const clientRes = await getE1Client(selectedSnapshot, { limit: FULL_LOAD_LIMIT });
          if (loadId !== activeLoadRef.current) return
          setClientDataResponse(clientRes as unknown as PricingDataResponse);
        } catch {
          if (loadId !== activeLoadRef.current) return
          setClientDataResponse(null);
        }
      })()
    } catch (e) {
      if (loadId !== activeLoadRef.current) return
      const message =
        e instanceof Error
          ? e.message
          : "Failed to load pricing data";
      setError(message);
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedSnapshot]);

  useEffect(() => {
    loadSnapshots();
    (async () => {
      try {
        const schemas = await getPricingSchemas();
        setPricingSchemas(schemas);
      } catch {
        // ignore
      }
    })();
  }, []);

  // Reload when snapshot changes
  useEffect(() => {
    loadData();
  }, [selectedSnapshot, loadData]); // Only depend on selectedSnapshot and loadData to avoid duplicate calls

  /* ---------------- Pipeline load/save handlers ---------------- */
  const handleLoadPipeline = (filters: Record<string, string[]>) => {
    setUniversalFilters(normalizeFilterKeys(filters))

    // Clear legacy filter state so it cannot create accidental combinatoric combinations.
    setSelectedCompetitors([])
    setSelectedLocations([])
    setSelectedDimensions([])
    setSelectedUnitCategories([])
  };

  const handlePipelineChange = (pipeline: Pipeline | null) => {
    setLocalAdjusters(pipeline?.adjusters || []);

    if (!pipeline) {
      setUniversalCombinatoric({})
      setRoundingEnabled(false)
      setRoundingOffset(0)
      return
    }

    const settingsFilters = normalizeFilterKeys((pipeline.filters ?? pipeline.settings?.universal_filters) as Record<string, string[]> | undefined)
    setUniversalFilters(settingsFilters)

    const nestedFilterSettings = (pipeline.settings?.filter_settings ?? {}) as Record<string, string>
    const legacyNested = (pipeline.settings?.filter_settings ?? {}) as {
      filter_modes?: Record<string, string>
      combinatoric_flags?: Record<string, boolean>
    }

    const normalizedFlags = normalizeCombinatoricFlagKeys(
      (legacyNested.combinatoric_flags ?? pipeline.settings?.combinatoric_flags) as Record<string, boolean> | undefined
    )
    const normalizedModes = normalizeFilterModeKeys(
      (Object.keys(nestedFilterSettings).length > 0
        ? nestedFilterSettings
        : (legacyNested.filter_modes ?? pipeline.settings?.filter_modes)) as Record<string, string> | undefined
    )
    const alignedFlags = Object.keys(settingsFilters).reduce((acc, key) => {
      const mode = normalizedModes[key]
      if (mode === 'combinatoric') {
        acc[key] = true
        return acc
      }
      if (mode === 'subset') {
        acc[key] = false
        return acc
      }

      // Backward compatibility: older pipelines may not have explicit flags.
      // Treat loaded filter dimensions as combinatoric by default.
      acc[key] = normalizedFlags[key] ?? true
      return acc
    }, {} as Record<string, boolean>)
    setUniversalCombinatoric(alignedFlags)

    const rounding = pipeline.settings?.rounding as { enabled?: boolean; offset?: number } | undefined;
    setRoundingEnabled(Boolean(rounding?.enabled));
    setRoundingOffset(Number(rounding?.offset ?? 0));
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
    const numericFromStats = Object.entries(columnsStats)
      .filter(([, stats]) => {
        const dtype = String((stats as { data_type?: string }).data_type ?? "").toLowerCase();
        return (
          dtype.includes("int") ||
          dtype.includes("float") ||
          dtype.includes("decimal") ||
          dtype.includes("double") ||
          dtype.includes("numeric") ||
          dtype === "number"
        );
      })
      .map(([col]) => col);

    // Fallback inference from currently loaded rows so function variables don't
    // disappear when column stats are partial/missing.
    const rowsToCheck = (baseRows ?? []).slice(0, 400) as Record<string, unknown>[];
    const inferredNumeric = new Set<string>();

    const toMaybeNumber = (value: unknown) => {
      if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
      const cleaned = String(value ?? "").trim().replace(/[,$%\s]/g, "");
      if (!cleaned) return NaN;
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : NaN;
    };

    if (rowsToCheck.length > 0) {
      const keys = new Set<string>();
      rowsToCheck.forEach((row) => Object.keys(row).forEach((k) => keys.add(k)));

      for (const key of keys) {
        let nonEmpty = 0;
        let numeric = 0;
        for (const row of rowsToCheck) {
          const raw = row[key];
          if (raw === null || raw === undefined || raw === "") continue;
          nonEmpty += 1;
          if (!Number.isNaN(toMaybeNumber(raw))) numeric += 1;
        }
        if (nonEmpty > 0 && numeric / nonEmpty >= 0.8) {
          inferredNumeric.add(key);
        }
      }
    }

    return Array.from(new Set([...numericFromStats, ...inferredNumeric])).sort();
  }, [columnsStats, baseRows]);

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
      .filter(([k]) => (allCombinatoricFlags[k] ?? true) === false)
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
      locations: 'client_location',
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

  // Combinatoric filters: preserve selected dimensions so loaded pipelines
  // keep all combinatoric columns visible.
  const combinatoricFilters = useMemo<Record<string, { mode: 'subset'; values: string[] }>>(() => {
    return Object.entries(allFilters)
      .filter(([k, v]) => {
        const filter = v as FilterMode
        const isCombinatoric = allCombinatoricFlags[k] ?? true
        return isCombinatoric && filter.mode === 'subset' && Array.isArray((filter as { mode: 'subset'; values: string[] }).values) && (filter as { mode: 'subset'; values: string[] }).values.length > 0
      })
      .reduce((acc, [k]) => {
        const filter = allFilters[k] as { mode: 'subset'; values: string[] }

        const FILTER_KEY_TO_COLUMN: Record<string, string> = {
          competitors: 'competitor_name',
          locations: 'client_location',
          dimensions: 'unit_dimensions',
          unit_categories: 'unit_category',
        }

        const resolvedColumn = FILTER_KEY_TO_COLUMN[k] ?? k
        // Prefer values that exist in the current subset, but never drop the
        // combinatoric dimension entirely (older saved pipelines can otherwise
        // appear to lose a column after load).
        const presentSet = new Set<string>()
        for (const row of subsetFilteredRows as { [key: string]: unknown }[]) {
          const cell = row[resolvedColumn]
          if (cell === null || cell === undefined) continue
          if (Array.isArray(cell)) {
            for (const item of cell as unknown[]) presentSet.add(String(item))
          } else {
            presentSet.add(String(cell))
          }
        }

        const selectedValues = filter.values.map(String)
        const presentValues = selectedValues.filter((v) => presentSet.has(v))
        acc[k] = {
          mode: 'subset',
          values: presentValues.length > 0 ? presentValues : selectedValues,
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

  const calculatedPriceTable = useMemo(
    () => calculatePriceTable({
      competitorData: subsetFilteredRows,
      clientAvailableUnits: clientDataResponse?.data.length || 0,
      adjusters: localAdjusters,
      currentDate,
      filters: mergedFilters,
      combinatoricFlags: mergedCombinatoricFlags,
    }),
    [subsetFilteredRows, clientDataResponse?.data.length, localAdjusters, currentDate, mergedFilters, mergedCombinatoricFlags]
  )

  const hasActiveFilterSelections = useMemo(() => {
    // Only consider filters “active” when they have selected values.
    return Object.values(universalFilters).some((vals) => Array.isArray(vals) && vals.length > 0)
  }, [universalFilters])

  // Check isDev only on client-side to avoid hydration mismatch
  const [isDev, setIsDev] = useState(false)
  useEffect(() => {
    setIsDev(process.env.NODE_ENV === 'development')
  }, [])

  useEffect(() => {
    setRoundingOffsetInput(String(roundingOffset))
  }, [roundingOffset])

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

  const handleRoundingOffsetChange = (value: string) => {
    setRoundingOffsetInput(value)
    const sanitized = value.replace(/[^0-9.]/g, "")
    if (sanitized === "" || sanitized === ".") {
      return
    }
    const next = Number(sanitized)
    if (Number.isNaN(next)) return
    const clamped = Math.min(1, Math.max(0, next))
    setRoundingOffset(clamped)
  }

  /* ---------------- Render ---------------- */
  const processCsvProps = {
    snapshotId: selectedSnapshot,
    filters: {
      competitors: selectedCompetitors,
      locations: selectedLocations,
      unit_dimensions: selectedDimensions,
      unitCategories: selectedUnitCategories,
      ...universalFilters,
    },
    adjusters: localAdjusters,
    combinatoric: universalCombinatoric,
    rounding: {
      enabled: roundingEnabled,
      offset: roundingOffset,
    },
    calculatedRows: calculatedPriceTable.rows,
    pricingContext: {
      competitorData: subsetFilteredRows,
      clientAvailableUnits: clientDataResponse?.data.length || 0,
      currentDate,
      filters: mergedFilters,
      combinatoricFlags: mergedCombinatoricFlags,
      availableVariables,
    },
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex flex-row min-w-max">
        {/* ── Left: pipeline content ── */}
        <main className="w-[min(1280px,100vw)] px-4 py-6 sm:px-6 space-y-4 sm:space-y-5 flex-shrink-0">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Pipelines</h1>
          </div>
          {isRefreshing && (
            <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
              Refreshing pricing data in background…
            </div>
          )}
          {loading && !dataResponse && (
            <div className="text-xs text-muted-foreground">Loading pricing data…</div>
          )}
          <header>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="min-w-0">
              </div>
              <div className="flex items-center gap-2">
                <PipelineSelector
                  currentFilters={universalFilters}
                  currentAdjusters={localAdjusters}
                  currentSettings={{
                    rounding: {
                      enabled: roundingEnabled,
                      offset: roundingOffset,
                    },
                    combinatoric_flags: universalCombinatoric,
                  }}
                  onLoadPipeline={handleLoadPipeline}
                  onPipelineChange={handlePipelineChange}
                />
              </div>
            </div>
          </header>

          <div>
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

        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-2 sm:gap-3 rounded-lg border bg-muted/30 p-3">
          <Button type="button" variant="outline" size="sm">
            Rounding
          </Button>
          <div className="flex items-center gap-2">
            <Checkbox
              id="rounding-enabled"
              checked={roundingEnabled}
              onCheckedChange={(checked) => setRoundingEnabled(Boolean(checked))}
            />
            <label htmlFor="rounding-enabled" className="text-sm">
              Enable
            </label>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="rounding-offset" className="text-xs text-muted-foreground">
              Round to
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                $
              </span>
              <Input
                id="rounding-offset"
                type="text"
                inputMode="decimal"
                value={roundingOffsetInput}
                onChange={(e) => handleRoundingOffsetChange(e.target.value)}
                className="h-8 w-[120px] pl-5"
              />
            </div>
            <span className="text-xs text-muted-foreground">($0.00 to $1.00)</span>
          </div>
        </div>

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
            <div className="flex flex-wrap items-center gap-2">
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
            roundingEnabled={roundingEnabled}
            roundingOffset={roundingOffset}
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
      </div>{/* end loading guard */}
        </main>
        {/* ── Right: Effect Pricing panel ── */}
        <aside className="flex-shrink-0 w-[560px] border-l px-4 py-6 space-y-4 self-start sticky top-0 min-h-screen">
          <div className="flex items-center gap-2 mb-2">
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">Effect Pricing</h2>
          </div>
          <ProcessCsvButton {...processCsvProps} inline />
        </aside>
      </div>
    </div>
  );
}

