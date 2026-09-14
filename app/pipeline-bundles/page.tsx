"use client";
import type { FilterSelection } from "@/components/pipelines/calculated-price";
import { calculatePriceTable } from "@/components/pipelines/calculated-price";
import { ProcessCsvButton } from "@/components/pricing/process-csv-button";
import { getCachedValue } from "@/lib/api/cache";
import { dedupePipelinesByName, getE1Client, listPipelines } from "@/lib/api/client/pipelines";
import { getAllPricingData, getColumnStatistics, getPricingData, getPricingSnapshots } from "@/lib/api/client/pricing";
import type { ColumnStatistics, E1DataResponse, Pipeline, PricingDataResponse, PricingSnapshot } from "@/lib/api/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PricingOverview } from "../pricing/components/pricing-overview";

const INITIAL_LOAD_LIMIT = 250;
const FULL_LOAD_LIMIT = 1000;
const getPricingDataCacheKey = (snapshot: string, limit: number) =>
  `pricing-data-${snapshot}-limit=${limit}`
const getE1ClientCacheKey = (snapshot: string, limit: number) =>
  `e1-client-${snapshot}-limit=${limit}`

const LEGACY_TO_COLUMN: Record<string, string> = {
  competitors: "competitor_name",
  locations: "client_location",
  client_location: "client_location",
  dimensions: "unit_dimensions",
  unit_categories: "unit_category",
};

type BundleCalculationInput = {
  pipelines: Pipeline[]
  baseRows: Array<Record<string, unknown>>
  clientAvailableUnits: number
  calculatedAt: string
}

export default function PipelineBundlesPage() {
  const normalizeFilterKeys = useCallback((filters?: Record<string, string[]>) => {
    const next: Record<string, string[]> = {};
    for (const [key, vals] of Object.entries(filters ?? {})) {
      if (!Array.isArray(vals) || vals.length === 0) continue;
      const resolvedKey = LEGACY_TO_COLUMN[key] ?? key;
      next[resolvedKey] = vals;
    }
    return next;
  }, []);

  const normalizeCombinatoricFlagKeys = useCallback((flags?: Record<string, boolean>) => {
    const next: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(flags ?? {})) {
      const resolvedKey = LEGACY_TO_COLUMN[key] ?? key;
      next[resolvedKey] = Boolean(value);
    }
    return next;
  }, []);

  const normalizeFilterModeKeys = useCallback((modes?: Record<string, string>) => {
    const next: Record<string, string> = {};
    for (const [key, value] of Object.entries(modes ?? {})) {
      const resolvedKey = LEGACY_TO_COLUMN[key] ?? key;
      next[resolvedKey] = value;
    }
    return next;
  }, []);

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);

  // Selected pipeline objects
  const [snapshots, setSnapshots] = useState<PricingSnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string>("latest");
  const [dataResponse, setDataResponse] = useState<PricingDataResponse | null>(null);
  const [clientDataResponse, setClientDataResponse] = useState<E1DataResponse | null>(null);
  const [columnsStats, setColumnsStats] = useState<Record<string, ColumnStatistics>>({});
  const [bundleCalculationInput, setBundleCalculationInput] = useState<BundleCalculationInput | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const hasLoadedDataRef = useRef(false)
  const activeLoadRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [pipelinesResult, snapshotsResult] = await Promise.allSettled([
        listPipelines(),
        getPricingSnapshots(),
      ])
      if (cancelled) return

      if (pipelinesResult.status === "fulfilled") setPipelines(dedupePipelinesByName(pipelinesResult.value))
      if (snapshotsResult.status === "fulfilled") setSnapshots(snapshotsResult.value)
    })()

    return () => {
      cancelled = true
    }
  }, []);

  useEffect(() => {
    if (!selectedSnapshot) return;

    setBundleCalculationInput(null)

    const loadId = ++activeLoadRef.current
    const cachedInitial = getCachedValue<PricingDataResponse>(
      getPricingDataCacheKey(selectedSnapshot, INITIAL_LOAD_LIMIT),
      { persist: true }
    )
    if (cachedInitial) {
      setDataResponse(cachedInitial)
      hasLoadedDataRef.current = true
    }

    const cachedClient = getCachedValue<E1DataResponse>(
      getE1ClientCacheKey(selectedSnapshot, FULL_LOAD_LIMIT),
      { persist: true }
    )
    if (cachedClient) setClientDataResponse(cachedClient)

    setColumnsStats({})
    const alreadyHasData = hasLoadedDataRef.current || Boolean(cachedInitial)
    if (alreadyHasData) {
      setLoading(false)
      setIsRefreshing(true)
    } else {
      setLoading(true)
    }

    void (async () => {
      try {
        const initialRes = await getPricingData(selectedSnapshot, { limit: INITIAL_LOAD_LIMIT })
        if (loadId !== activeLoadRef.current) return
        setDataResponse(initialRes)
        hasLoadedDataRef.current = true
        setLoading(false)
        setIsRefreshing(false)

        void (async () => {
          try {
            const fullRes = await getAllPricingData(selectedSnapshot)
            if (loadId !== activeLoadRef.current) return
            setDataResponse(fullRes)

            if (fullRes.columns?.length) {
              const stats = await getColumnStatistics(selectedSnapshot, fullRes.columns)
              if (loadId !== activeLoadRef.current) return
              const statsObj: Record<string, ColumnStatistics> = {}
              stats.forEach((s: ColumnStatistics) => {
                statsObj[s.column] = s
              })
              setColumnsStats(statsObj)
            }
          } catch {
            // Keep initial payload visible if full payload/statistics fail.
          }
        })()

        void (async () => {
          try {
            const clientRes = await getE1Client(selectedSnapshot, { limit: FULL_LOAD_LIMIT })
            if (loadId !== activeLoadRef.current) return
            setClientDataResponse(clientRes)
          } catch {
            if (loadId !== activeLoadRef.current) return
            setClientDataResponse(null)
          }
        })()
      } catch {
        if (loadId !== activeLoadRef.current) return
        setLoading(false)
        setIsRefreshing(false)
      }
    })()
  }, [selectedSnapshot]);

  const currentDate = useMemo(() => new Date(), []);

  const availableVariables = useMemo(() => {
    const numericCols = Object.entries(columnsStats)
      .filter(([, stats]) => {
        const dtype = String((stats as { data_type?: string }).data_type ?? "").toLowerCase();
        return dtype.includes("int") || dtype.includes("float") || dtype.includes("decimal") || dtype.includes("number");
      })
      .map(([col]) => col)
      .sort();
    return numericCols;
  }, [columnsStats]);

  const selectedPipelineContexts = useMemo(() => {
    if (!bundleCalculationInput) return []

    const baseRows = bundleCalculationInput.baseRows;
    const calcPipelines = bundleCalculationInput.pipelines;
    const snapshotClientAvailableUnits = bundleCalculationInput.clientAvailableUnits;
    const calculationDate = new Date(bundleCalculationInput.calculatedAt);

    const applyConfiguredRounding = (value: number, rounding?: { enabled?: boolean; offset?: number }) => {
      if (!rounding?.enabled || !Number.isFinite(value)) return value;
      const offsetRaw = Number(rounding.offset ?? 0);
      const offset = Math.min(1, Math.max(0, offsetRaw));
      const rounded = Math.round(value - offset) + offset;
      return Object.is(rounded, -0) ? 0 : rounded;
    };

    const normalizeValuesForColumn = (column: string, values: string[]) => {
      if (!Array.isArray(values) || values.length === 0) return [] as string[];
      const canonicalByKey = new Map<string, string>();
      for (const row of baseRows) {
        const cell = row[column];
        if (cell === null || cell === undefined) continue;
        if (Array.isArray(cell)) {
          for (const item of cell) {
            const s = String(item);
            canonicalByKey.set(s.trim().toLowerCase(), s);
          }
        } else {
          const s = String(cell);
          canonicalByKey.set(s.trim().toLowerCase(), s);
        }
      }

      const next: string[] = [];
      const seen = new Set<string>();
      for (const raw of values) {
        const key = String(raw).trim().toLowerCase();
        const canonical = canonicalByKey.get(key);
        if (!canonical) continue;
        if (seen.has(canonical)) continue;
        seen.add(canonical);
        next.push(canonical);
      }
      return next.length > 0 ? next : values;
    };

    return calcPipelines.map((pipeline) => {
      const adjusters = pipeline.adjusters || [];
      const settings = (pipeline.settings ?? {}) as Record<string, unknown>;
      const nestedFilterSettings = (settings.filter_settings ?? {}) as Record<string, string>
      const legacyNested = (settings.filter_settings ?? {}) as {
        combinatoric_flags?: Record<string, boolean>
        filter_modes?: Record<string, string>
      }
      const settingsFilters = normalizeFilterKeys((pipeline.filters ?? settings.universal_filters) as Record<string, string[]> | undefined);
      const normalizedFlags = normalizeCombinatoricFlagKeys(((legacyNested.combinatoric_flags ?? settings.combinatoric_flags) as Record<string, boolean> | undefined));
      const normalizedModes = normalizeFilterModeKeys(((Object.keys(nestedFilterSettings).length > 0
        ? nestedFilterSettings
        : (legacyNested.filter_modes ?? settings.filter_modes)) as Record<string, string> | undefined));

      const normalizedSettingsFilters = Object.entries(settingsFilters).reduce((acc, [key, values]) => {
        if (!Array.isArray(values) || values.length === 0) return acc;
        const normalizedValues = normalizeValuesForColumn(key, values);
        if (!Array.isArray(normalizedValues) || normalizedValues.length === 0) return acc;
        acc[key] = normalizedValues;
        return acc;
      }, {} as Record<string, string[]>);

      const combinatoricFlags = Object.keys(normalizedSettingsFilters).reduce((acc, key) => {
        const mode = normalizedModes[key];
        if (mode === "combinatoric") {
          acc[key] = true;
          return acc;
        }
        if (mode === "subset") {
          acc[key] = false;
          return acc;
        }
        acc[key] = normalizedFlags[key] ?? true;
        return acc;
      }, {} as Record<string, boolean>);

      const subsetFilters = Object.entries(normalizedSettingsFilters).reduce((acc, [key, values]) => {
        if ((combinatoricFlags[key] ?? true) !== false) return acc;
        if (!Array.isArray(values) || values.length === 0) return acc;
        acc[key] = values;
        return acc;
      }, {} as Record<string, string[]>);

      const subsetFilteredRows = Object.entries(subsetFilters).reduce((rows, [col, vals]) => {
        if (!Array.isArray(vals) || vals.length === 0) return rows;
        const sel = new Set(vals.map((v) => String(v)));
        return rows.filter((r) => {
          const v = r[col];
          if (v === null || v === undefined) return false;
          if (Array.isArray(v)) return v.some((x) => sel.has(String(x)));
          return sel.has(String(v));
        });
      }, baseRows);

      const combinatoricFilters = Object.entries(normalizedSettingsFilters).reduce((acc, [key, values]) => {
        if ((combinatoricFlags[key] ?? true) !== true) return acc;
        if (!Array.isArray(values) || values.length === 0) return acc;

        const presentSet = new Set<string>();
        for (const row of subsetFilteredRows) {
          const cell = row[key];
          if (cell === null || cell === undefined) continue;
          if (Array.isArray(cell)) {
            for (const item of cell) presentSet.add(String(item));
          } else {
            presentSet.add(String(cell));
          }
        }

        const selectedValues = values.map(String);
        const presentValues = selectedValues.filter((v) => presentSet.has(v));
        acc[key] = presentValues.length > 0 ? presentValues : selectedValues;
        return acc;
      }, {} as Record<string, string[]>);

      const filters = {
        ...Object.entries(subsetFilters).reduce((acc, [key, values]) => {
          acc[key] = { mode: "subset", values };
          return acc;
        }, {} as Record<string, FilterSelection<string>>),
        ...Object.entries(combinatoricFilters).reduce((acc, [key, values]) => {
          acc[key] = { mode: "subset", values };
          return acc;
        }, {} as Record<string, FilterSelection<string>>),
      };

      const mergedCombinatoricFlags = Object.fromEntries(
        Object.keys(combinatoricFilters).map((k) => [k, true])
      ) as Record<string, boolean>;

      const rounding = (settings.rounding as { enabled?: boolean; offset?: number } | undefined) ?? {};
      const roundingEnabled = Boolean(rounding.enabled);
      const roundingOffset = Number(rounding.offset ?? 0);

      // IMPORTANT: keep Process CSV calculation path identical to Pipelines page
      // so both surfaces operate on the same calculated combination set.
      const rowsForCsvCalc = subsetFilteredRows as PricingDataResponse["data"];
      const calculatedRowsForCsv = calculatePriceTable({
        competitorData: rowsForCsvCalc,
        clientAvailableUnits: snapshotClientAvailableUnits,
        adjusters,
        currentDate: calculationDate,
        filters,
        combinatoricFlags: mergedCombinatoricFlags,
        existingCombinationsOnly: true,
        maxCombinations: Math.max(rowsForCsvCalc.length, 1),
      }).rows;

      const roundedCalculatedRowsForCsv = calculatedRowsForCsv.map((row) => {
        if (typeof row.price !== "number" || Number.isNaN(row.price)) return row;
        return {
          ...row,
          price: applyConfiguredRounding(row.price, rounding),
        };
      });

      const processCsvDebugEnabled = (() => {
        if (typeof window === "undefined") return false;
        try {
          const value = String(window.localStorage.getItem("process-csv-debug-match") ?? "").trim().toLowerCase();
          return value === "1" || value === "true" || value === "on" || value === "yes";
        } catch {
          return false;
        }
      })();

      if (processCsvDebugEnabled && typeof window !== "undefined") {
        try {
          const summary = {
            pipelineName: pipeline.name,
            baseRows: baseRows.length,
            subsetFilteredRows: subsetFilteredRows.length,
            rowsForCsvCalc: rowsForCsvCalc.length,
            calculatedRowsForCsv: calculatedRowsForCsv.length,
            roundedCalculatedRowsForCsv: roundedCalculatedRowsForCsv.length,
            filterKeys: Object.keys(filters),
            combinatoricKeys: Object.keys(mergedCombinatoricFlags).filter((key) => Boolean(mergedCombinatoricFlags[key])),
            matchesPipelinesPagePath: true,
          };

          console.info("[Pipeline Bundles Debug] Calculated rows summary", summary);
          console.info("[Pipeline Bundles Debug] Calculated rows (comboMap + price)", {
            pipelineName: pipeline.name,
            rows: roundedCalculatedRowsForCsv,
          });

          const existingRaw = (() => {
            try {
              return JSON.parse(window.localStorage.getItem("process-csv-last-bundle-debug") ?? "[]") as Array<Record<string, unknown>>;
            } catch {
              return [] as Array<Record<string, unknown>>;
            }
          })();

          const nextRaw = [
            ...existingRaw.filter((item) => String(item.pipelineName ?? "") !== String(pipeline.name ?? "")),
            {
              created_at: new Date().toISOString(),
              pipelineName: pipeline.name,
              summary,
              rows: roundedCalculatedRowsForCsv,
            },
          ];

          window.localStorage.setItem("process-csv-last-bundle-debug", JSON.stringify(nextRaw));
        } catch {
          // ignore debug logging failures
        }
      }

      return {
        pipeline,
        adjusters,
        subsetFilteredRows: subsetFilteredRows as PricingDataResponse["data"],
        filters,
        mergedCombinatoricFlags,
        roundingEnabled,
        roundingOffset,
        calculatedRowsForCsv: roundedCalculatedRowsForCsv,
      };
    });
  }, [
    bundleCalculationInput,
    normalizeFilterKeys,
    normalizeCombinatoricFlagKeys,
    normalizeFilterModeKeys,
  ]);

  const prepareBundleCalculation = useCallback(() => {
    const clone = <T,>(value: T): T => {
      if (typeof structuredClone === "function") return structuredClone(value)
      return JSON.parse(JSON.stringify(value)) as T
    }

    setBundleCalculationInput({
      pipelines: clone(pipelines),
      baseRows: clone((dataResponse?.data ?? []) as Array<Record<string, unknown>>),
      clientAvailableUnits: clientDataResponse?.data.length || 0,
      calculatedAt: new Date().toISOString(),
    })
  }, [pipelines, dataResponse?.data, clientDataResponse?.data.length])

  const calculatedRowsBundle = useMemo(() => {
    return selectedPipelineContexts.map((ctx) => {
      return {
        pipelineName: String(ctx.pipeline.name ?? "").trim() || "Unnamed pipeline",
        rows: ctx.calculatedRowsForCsv,
      };
    });
  }, [selectedPipelineContexts]);

  return (
    <main className="px-4 py-6 sm:px-6 space-y-4 sm:space-y-5">
      <h1 className="text-2xl font-bold mb-6">Pipeline Bundles</h1>
      {isRefreshing && (
        <div className="text-xs rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-blue-700">
          Refreshing pricing data in background…
        </div>
      )}
      
      {loading && !dataResponse && (
        <div className="text-xs text-muted-foreground">Loading pricing data…</div>
      )}
      {/* Overview and snapshot selector */}
      <div className="mb-8">
        <PricingOverview
          selectedSnapshot={selectedSnapshot}
          snapshots={snapshots}
          dataResponse={dataResponse}
          columnsStats={columnsStats}
          onSnapshotChange={setSelectedSnapshot}
        />
      </div>
      <div className="mb-2 overflow-x-auto snap-x snap-mandatory">
        <div className="flex min-h-[calc(100dvh-16rem)] gap-6">
          <section className="flex w-full min-w-full max-w-full shrink-0 snap-start flex-col space-y-3">
            <div className="min-h-0 flex-1">
              <ProcessCsvButton
                inline
                snapshotId={selectedSnapshot}
                filters={{ competitors: [], locations: [], unit_dimensions: [], unitCategories: [] }}
                rounding={{ enabled: false, offset: 0 }}
                allowCompetitiveAdjuster={false}
                mappingDialogClassName="sm:max-w-[92vw] lg:max-w-[1400px]"
                calculatedRowsBundle={calculatedRowsBundle}
                onCsvFileSelected={(file) => {
                  if (file) prepareBundleCalculation()
                }}
                pricingContext={{
                  competitorData: dataResponse?.data ?? [],
                  clientAvailableUnits: clientDataResponse?.data.length || 0,
                  currentDate,
                  filters: {},
                  combinatoricFlags: selectedPipelineContexts[0]?.mergedCombinatoricFlags ?? {},
                  availableVariables,
                }}
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
