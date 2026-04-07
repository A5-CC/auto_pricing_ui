"use client";

import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { Adjuster } from "@/lib/adjusters";
import { createPipeline, deletePipeline, listPipelines } from "@/lib/api/client/pipelines";
import type { Pipeline, PipelineFilterMode, PipelineFilters, PipelineSettings } from "@/lib/api/types";
import { Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { DeletePipelineDialog } from "./delete-pipeline-dialog";
import { SavePipelineDialog } from "./save-pipeline-dialog";

const LEGACY_TO_CANONICAL: Record<string, string> = {
  competitors: "competitor_name",
  locations: "client_location",
  client_location: "client_location",
  dimensions: "unit_dimensions",
  unit_categories: "unit_category",
};

function dedupeValues(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) return [];

  const seen = new Set<string>();
  const next: string[] = [];

  for (const value of values) {
    const normalized = String(value);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    next.push(normalized);
  }

  return next;
}

function normalizeToCanonicalFilters(filters?: Record<string, string[]>): Record<string, string[]> {
  const next: Record<string, string[]> = {};

  for (const [key, values] of Object.entries(filters ?? {})) {
    const normalizedValues = dedupeValues(values);
    if (normalizedValues.length === 0) continue;

    const resolvedKey = LEGACY_TO_CANONICAL[key] ?? key;
    next[resolvedKey] = dedupeValues([...(next[resolvedKey] ?? []), ...normalizedValues]);
  }

  return next;
}

function normalizeFlagKeys(flags?: Record<string, boolean>): Record<string, boolean> {
  const next: Record<string, boolean> = {};

  for (const [key, value] of Object.entries(flags ?? {})) {
    const resolvedKey = LEGACY_TO_CANONICAL[key] ?? key;
    next[resolvedKey] = Boolean(value);
  }

  return next;
}

function normalizeModeKeys(modes?: Record<string, PipelineFilterMode>): Record<string, PipelineFilterMode> {
  const next: Record<string, PipelineFilterMode> = {};

  for (const [key, value] of Object.entries(modes ?? {})) {
    const resolvedKey = LEGACY_TO_CANONICAL[key] ?? key;
    next[resolvedKey] = value;
  }

  return next;
}

function compactFilters(filters: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(filters).filter(([, values]) => Array.isArray(values) && values.length > 0)
  );
}

function buildLegacyFilters(filters?: Record<string, string[]>): PipelineFilters {
  const canonicalFilters = normalizeToCanonicalFilters(filters);

  return compactFilters({
    competitors: canonicalFilters.competitor_name ?? [],
    locations: canonicalFilters.client_location ?? [],
    dimensions: canonicalFilters.unit_dimensions ?? [],
    unit_categories: canonicalFilters.unit_category ?? [],
  }) as PipelineFilters;
}

interface PipelineSelectorProps {
  currentFilters: PipelineFilters;
  currentAdjusters: Adjuster[];
  currentSettings?: PipelineSettings;
  onLoadPipeline: (filters: PipelineFilters) => void;
  onPipelineChange?: (pipeline: Pipeline | null) => void;
}

export function PipelineSelector({
  currentFilters,
  currentAdjusters,
  currentSettings,
  onLoadPipeline,
  onPipelineChange,
}: PipelineSelectorProps) {
  const LOCAL_STORAGE_KEY = "auto_pricing_pipeline_extras";
  const [pipelines, setPipelines] = useState<Pipeline[]>(() => {
    // Seed immediately from localStorage so the dropdown shows on first paint
    if (typeof window === 'undefined') return []
    try {
      const raw = window.localStorage.getItem('__apu_cache__pipelines-list')
      if (!raw) return []
      const { data, ts } = JSON.parse(raw) as { data: Pipeline[]; ts: number }
      if (Date.now() - ts > 30 * 60 * 1000) return []
      return Array.isArray(data) ? data : []
    } catch {
      return []
    }
  });
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const readLocalExtras = useCallback(() => {
    if (typeof window === "undefined") return {} as Record<string, { filters: Record<string, string[]>; settings?: PipelineSettings }>;
    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, { filters: Record<string, string[]>; settings?: PipelineSettings }>;
    } catch {
      return {} as Record<string, { filters: Record<string, string[]>; settings?: PipelineSettings }>;
    }
  }, []);

  const writeLocalExtras = useCallback((extras: Record<string, { filters: Record<string, string[]>; settings?: PipelineSettings }>) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(extras));
    } catch {
      // ignore
    }
  }, []);

  const buildPersistedSettings = useCallback((
    filters: Record<string, string[]>,
    settings?: PipelineSettings
  ): PipelineSettings | undefined => {
    const canonicalFilters = normalizeToCanonicalFilters(filters);
    const activeKeys = Object.keys(canonicalFilters).filter(
      (key) => Array.isArray(canonicalFilters[key]) && canonicalFilters[key].length > 0
    );
    const combinatoricFlagsByKey = normalizeFlagKeys(settings?.combinatoric_flags);
    const filterModesByKey = normalizeModeKeys(settings?.filter_modes);
    const combinatoricFlags = Object.fromEntries(
      activeKeys.map((key) => {
        const mode = filterModesByKey[key];
        const value = mode === "combinatoric"
          ? true
          : mode === "subset"
            ? false
            : Boolean(combinatoricFlagsByKey[key]);

        return [key, value];
      })
    ) as Record<string, boolean>;
    const filterModes = Object.fromEntries(
      activeKeys.map((key) => [key, combinatoricFlags[key] ? "combinatoric" : "subset"])
    ) as Record<string, PipelineFilterMode>;
    const universalFilters = Object.fromEntries(
      activeKeys.map((key) => [key, canonicalFilters[key]])
    ) as Record<string, string[]>;

    if (!settings && activeKeys.length === 0) return undefined;

    const persisted: PipelineSettings = {
      ...settings,
      universal_filters: universalFilters,
      filter_modes: filterModes,
    };

    if (!persisted.universal_filters || Object.keys(persisted.universal_filters).length === 0) {
      delete persisted.universal_filters;
    }
    if (!persisted.filter_modes || Object.keys(persisted.filter_modes).length === 0) {
      delete persisted.filter_modes;
    }

    // Canonical persistence: keep only filter_modes for combinatoric state.
    // Backward compatibility on read still supports combinatoric_flags.
    delete persisted.combinatoric_flags;

    return persisted;
  }, []);

  const normalizePipelineForUi = useCallback((
    pipeline: Pipeline,
    extra?: { filters: Record<string, string[]>; settings?: PipelineSettings }
  ): Pipeline => {
    const mergedSettings: PipelineSettings | undefined = extra?.settings || pipeline.settings
      ? {
          ...pipeline.settings,
          ...extra?.settings,
          universal_filters: {
            ...(pipeline.settings?.universal_filters ?? {}),
            ...(extra?.settings?.universal_filters ?? {}),
          },
          combinatoric_flags: {
            ...(pipeline.settings?.combinatoric_flags ?? {}),
            ...(extra?.settings?.combinatoric_flags ?? {}),
          },
          filter_modes: {
            ...(pipeline.settings?.filter_modes ?? {}),
            ...(extra?.settings?.filter_modes ?? {}),
          },
        }
      : undefined;

    const legacyFilters = compactFilters({
      ...((pipeline.filters ?? {}) as Record<string, string[]>),
      ...(extra?.filters ?? {}),
    }) as PipelineFilters;

    const canonicalFilters = normalizeToCanonicalFilters({
      ...legacyFilters,
      ...(mergedSettings?.universal_filters ?? {}),
    });

    return {
      ...pipeline,
      filters: legacyFilters,
      settings: buildPersistedSettings(canonicalFilters, mergedSettings),
    };
  }, [buildPersistedSettings]);

  const loadPipelines = useCallback(async () => {
    try {
      const data = await listPipelines();
      const extras = readLocalExtras();
      const merged = data.map((pipeline) => normalizePipelineForUi(pipeline, extras[pipeline.id]));
      setPipelines(merged);
    } catch (error) {
      console.error("Failed to load pipelines:", error);
      // Keep whatever stale pipelines were already seeded from localStorage
    }
  }, [normalizePipelineForUi, readLocalExtras]);

  useEffect(() => {
    loadPipelines();
  }, [loadPipelines]);

  const handleSelectPipeline = (pipelineId: string) => {
    if (pipelineId === "none") {
      setSelectedPipelineId(null);
      onLoadPipeline({
        competitors: [],
        locations: [],
        dimensions: [],
        unit_categories: [],
      });
      onPipelineChange?.(null);
      return;
    }

    const pipeline = pipelines.find((p: Pipeline) => p.id === pipelineId);
    if (pipeline) {
      setSelectedPipelineId(pipelineId);
      onLoadPipeline(
        buildLegacyFilters(
          (pipeline.settings?.universal_filters as Record<string, string[]> | undefined)
          ?? (pipeline.filters as Record<string, string[]> | undefined)
        )
      );
      onPipelineChange?.(pipeline);
    }
  };

  const handleSavePipeline = async (name: string) => {
    try {
      const canonicalFilters = normalizeToCanonicalFilters({
        ...currentFilters,
        ...(currentSettings?.universal_filters ?? {}),
      });
      const mergedFilters = {} as PipelineFilters;
      const persistedSettings = buildPersistedSettings(canonicalFilters, currentSettings);
      const newPipeline = await createPipeline({
        name,
        filters: mergedFilters,
        adjusters: currentAdjusters,
        settings: persistedSettings,
      });
      const extras = readLocalExtras();
      extras[newPipeline.id] = { filters: {}, settings: persistedSettings };
      writeLocalExtras(extras);
      setPipelines((prev: Pipeline[]) => [normalizePipelineForUi(newPipeline, extras[newPipeline.id]), ...prev]);
      setSelectedPipelineId(newPipeline.id);
    } catch (error) {
      console.error("Failed to save pipeline:", error);
      throw error;
    }
  };

  const handleDeletePipeline = async () => {
    if (!selectedPipelineId) return;
    await deletePipeline(selectedPipelineId);
    const extras = readLocalExtras();
    if (extras[selectedPipelineId]) {
      delete extras[selectedPipelineId];
      writeLocalExtras(extras);
    }
    setPipelines((prev: Pipeline[]) => prev.filter((p: Pipeline) => p.id !== selectedPipelineId));
    setSelectedPipelineId(null);
    onLoadPipeline({
      competitors: [],
      locations: [],
      dimensions: [],
      unit_categories: [],
    });
    onPipelineChange?.(null);
  };

  const selectedPipeline = pipelines.find((p: Pipeline) => p.id === selectedPipelineId);

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedPipelineId || "none"}
        onValueChange={handleSelectPipeline}
      >
        <SelectTrigger className="w-[240px]">
          <SelectValue placeholder="Load pipeline..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">
            <span className="text-muted-foreground">No pipeline</span>
          </SelectItem>
          {pipelines.map((pipeline: Pipeline) => (
            <SelectItem key={pipeline.id} value={pipeline.id}>
              {pipeline.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="icon"
        onClick={() => setSaveDialogOpen(true)}
        title="Save current filters as pipeline"
      >
        <Save className="h-4 w-4" />
      </Button>

      {selectedPipelineId && (
        <Button
          variant="outline"
          size="icon"
          onClick={() => setDeleteDialogOpen(true)}
          title="Delete selected pipeline"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}

      <SavePipelineDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        onSave={handleSavePipeline}
      />

      {selectedPipeline && (
        <DeletePipelineDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={handleDeletePipeline}
          pipelineName={selectedPipeline.name}
        />
      )}
    </div>
  );
}
