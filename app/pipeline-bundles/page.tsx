"use client";
import type { FilterSelection } from "@/components/pipelines/calculated-price";
import { calculatePriceTable } from "@/components/pipelines/calculated-price";
import { ProcessCsvButton } from "@/components/pricing/process-csv-button";
import { SectionLabel } from "@/components/ui/section-label";
import { getE1Client, listPipelines } from "@/lib/api/client/pipelines";
import { getColumnStatistics, getPricingData, getPricingSnapshots } from "@/lib/api/client/pricing";
import type { ColumnStatistics, E1DataResponse, Pipeline, PricingDataResponse, PricingSnapshot } from "@/lib/api/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PricingOverview } from "../pricing/components/pricing-overview";

const FULL_LOAD_LIMIT = 1000;

const LEGACY_TO_COLUMN: Record<string, string> = {
  competitors: "competitor_name",
  locations: "client_location",
  client_location: "client_location",
  dimensions: "unit_dimensions",
  unit_categories: "unit_category",
};

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

  useEffect(() => {
    listPipelines().then(setPipelines);
    getPricingSnapshots().then(setSnapshots);
  }, []);

  useEffect(() => {
    if (!selectedSnapshot) return;
    getPricingData(selectedSnapshot, { limit: FULL_LOAD_LIMIT }).then(setDataResponse);
    getE1Client(selectedSnapshot, { limit: 1000 }).then(setClientDataResponse).catch(() => setClientDataResponse(null));
    getColumnStatistics(selectedSnapshot).then((stats: ColumnStatistics[]) => {
      const statsObj: Record<string, ColumnStatistics> = {};
      stats.forEach((s: ColumnStatistics) => { statsObj[s.column] = s; });
      setColumnsStats(statsObj);
    });
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
    const baseRows = (dataResponse?.data ?? []) as Array<Record<string, unknown>>;

    const applyConfiguredRounding = (value: number, rounding?: { enabled?: boolean; offset?: number }) => {
      if (!rounding?.enabled || !Number.isFinite(value)) return value;
      const offsetRaw = Number(rounding.offset ?? 0);
      const offset = Math.min(1, Math.max(0, offsetRaw));
      const rounded = Math.round(value - offset) + offset;
      return Object.is(rounded, -0) ? 0 : rounded;
    };

    const computeAreaFromDimensionLikeValue = (value: unknown): string => {
      const raw = String(value ?? "").toLowerCase().replace(/×/g, "x");
      const match = raw.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/);
      if (!match) return "";
      const a = Number(match[1]);
      const b = Number(match[2]);
      if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return "";
      const area = a * b;
      return Number.isInteger(area) ? String(Math.trunc(area)) : String(area);
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

    return pipelines.map((pipeline) => {
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

      const calculatedRows = calculatePriceTable({
        competitorData: subsetFilteredRows as PricingDataResponse["data"],
        clientAvailableUnits: clientDataResponse?.data.length || 0,
        adjusters,
        currentDate,
        filters,
        combinatoricFlags: mergedCombinatoricFlags,
      }).rows;

      const roundedCalculatedRows = calculatedRows.map((row) => {
        if (typeof row.price !== "number" || Number.isNaN(row.price)) return row;
        return {
          ...row,
          price: applyConfiguredRounding(row.price, rounding),
        };
      });

      const getDistinctValues = (rows: Array<Record<string, unknown>>, key: string): string[] => {
        const set = new Set<string>();
        for (const row of rows) {
          const cell = row[key];
          if (cell === null || cell === undefined || cell === "") continue;
          if (Array.isArray(cell)) {
            for (const item of cell) {
              const next = String(item);
              if (next) set.add(next);
            }
          } else {
            const next = String(cell);
            if (next) set.add(next);
          }
        }
        return Array.from(set);
      };

      const deriveUnitAreaRows = (rows: Array<Record<string, unknown>>) => {
        return rows.map((row) => {
          if (row.unit_area !== undefined && row.unit_area !== null && row.unit_area !== "") {
            return row;
          }
          const area = computeAreaFromDimensionLikeValue(row.unit_dimensions);
          if (!area) return row;
          return { ...row, unit_area: area };
        });
      };

      // CSV mapping requires these combinatoric keys to exist in comboMap.
      // Keep on-page tables unchanged, but generate CSV rows with enforced keys.
      const csvFilters: Record<string, FilterSelection<string>> = { ...filters };
      const csvCombinatoricFlags: Record<string, boolean> = { ...mergedCombinatoricFlags };

      const baseRowsForCsv = baseRows.length > 0 ? baseRows : (subsetFilteredRows as Array<Record<string, unknown>>);
      let rowsForCsvCalc = (subsetFilteredRows.length > 0 ? subsetFilteredRows : baseRowsForCsv) as Array<Record<string, unknown>>;

      const ensureCombinatoricKey = (key: string) => {
        const existing = csvFilters[key];
        const existingVals = existing && existing.mode === "subset" ? existing.values : [];
        const fallbackVals = getDistinctValues(subsetFilteredRows, key);
        const fallbackFromBase = fallbackVals.length > 0 ? fallbackVals : getDistinctValues(baseRowsForCsv, key);
        const values = (existingVals?.length ? existingVals : fallbackFromBase).map(String).filter(Boolean);
        if (values.length === 0) return;
        csvFilters[key] = { mode: "subset", values };
        csvCombinatoricFlags[key] = true;
      };

      ensureCombinatoricKey("client_location");
      ensureCombinatoricKey("unit_dimensions");
      if (csvFilters.unit_area || settingsFilters.unit_area) {
        rowsForCsvCalc = deriveUnitAreaRows(rowsForCsvCalc);
      }
      const unitAreaFallbackValues = getDistinctValues(rowsForCsvCalc, "unit_area");
      if (unitAreaFallbackValues.length > 0) {
        const existing = csvFilters.unit_area;
        const existingVals = existing && existing.mode === "subset" ? existing.values : [];
        const values = (existingVals?.length ? existingVals : unitAreaFallbackValues).map(String).filter(Boolean);
        if (values.length > 0) {
          csvFilters.unit_area = { mode: "subset", values };
          csvCombinatoricFlags.unit_area = true;
        }
      }
      // Optional, used when CSV includes Unit Type drive-up signal
      ensureCombinatoricKey("has_drive_up_access");

      const calculatedRowsForCsv = calculatePriceTable({
        competitorData: rowsForCsvCalc as PricingDataResponse["data"],
        clientAvailableUnits: clientDataResponse?.data.length || 0,
        adjusters,
        currentDate,
        filters: csvFilters,
        combinatoricFlags: csvCombinatoricFlags,
      }).rows;

      const roundedCalculatedRowsForCsv = calculatedRowsForCsv.map((row) => {
        if (typeof row.price !== "number" || Number.isNaN(row.price)) return row;
        return {
          ...row,
          price: applyConfiguredRounding(row.price, rounding),
        };
      });

      return {
        pipeline,
        adjusters,
        subsetFilteredRows: subsetFilteredRows as PricingDataResponse["data"],
        filters,
        mergedCombinatoricFlags,
        roundingEnabled,
        roundingOffset,
        calculatedRows: roundedCalculatedRows,
        calculatedRowsForCsv: roundedCalculatedRowsForCsv,
      };
    });
  }, [
    pipelines,
    dataResponse,
    clientDataResponse?.data.length,
    currentDate,
    normalizeFilterKeys,
    normalizeCombinatoricFlagKeys,
    normalizeFilterModeKeys,
  ]);

  return (
    <main className="px-4 py-6 sm:px-6 space-y-4 sm:space-y-5">
      <h1 className="text-2xl font-bold mb-6">Pipeline Bundles</h1>
      <div className="mb-8 text-muted-foreground"></div>
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
      <div className="mb-6 overflow-x-auto snap-x snap-mandatory">
        <div className="flex gap-6">
          <section className="w-full min-w-full max-w-full shrink-0 snap-start space-y-3">
            <SectionLabel text="Effect Pricing" />
            <ProcessCsvButton
              inline
              snapshotId={selectedSnapshot}
              filters={{ competitors: [], locations: [], unit_dimensions: [], unitCategories: [] }}
              rounding={{ enabled: false, offset: 0 }}
              calculatedRowsBundle={selectedPipelineContexts.map((ctx) => ({
                pipelineName: ctx.pipeline.name,
                rows: ctx.calculatedRowsForCsv,
              }))}
              pricingContext={{
                competitorData: dataResponse?.data ?? [],
                clientAvailableUnits: clientDataResponse?.data.length || 0,
                currentDate,
                filters: {},
                combinatoricFlags: selectedPipelineContexts[0]?.mergedCombinatoricFlags ?? {},
                availableVariables,
              }}
            />
          </section>
        </div>
      </div>
    </main>
  );
}
