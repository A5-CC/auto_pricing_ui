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
import { createPipeline, dedupePipelinesByName, deletePipeline, invalidatePipelinesListCache, listPipelines, updatePipeline } from "@/lib/api/client/pipelines";
import type { Pipeline } from "@/lib/api/types";
import { ArrowUpDown, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DeletePipelineDialog } from "./delete-pipeline-dialog";
import { SavePipelineDialog } from "./save-pipeline-dialog";





interface PipelineSelectorProps {
  currentFilters: Record<string, string[]>;
  currentAdjusters: Adjuster[];
  currentSettings?: {
    combinatoric_flags?: Record<string, boolean>;
    filter_modes?: Record<string, "combinatoric" | "subset">;
    [key: string]: unknown;
  };
  onLoadPipeline: (filters: Record<string, string[]>) => void;
  onPipelineChange?: (pipeline: Pipeline | null) => void;
}

type LocalPipelineExtra = {
  filters: Record<string, string[]>
  settings?: Record<string, unknown>
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
      return Array.isArray(data) ? dedupePipelinesByName(data) : []
    } catch {
      return []
    }
  });
  const [nameSortDirection, setNameSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);


  // Keep local extras for optimistic UI fallback while API cache refreshes.
  const readLocalExtras = useCallback(() => {
      if (typeof window === "undefined") return {} as Record<string, LocalPipelineExtra>;
      try {
        const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!raw) return {};
        return JSON.parse(raw) as Record<string, LocalPipelineExtra>;
      } catch {
        return {} as Record<string, LocalPipelineExtra>;
      }
    }, []);

  const writeLocalExtras = useCallback((extras: Record<string, LocalPipelineExtra>) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(extras));
    } catch {
      // ignore
    }
  }, []);

  // Normalize pipeline for UI: use root-level filters only.
  const normalizePipelineForUi = useCallback((
    pipeline: Pipeline,
    extra?: LocalPipelineExtra
  ): Pipeline => {
    const serverFilters = (pipeline.filters as Record<string, string[]> | undefined) ?? {}
    const serverSettings = (pipeline.settings as Record<string, unknown> | undefined) ?? {}
    const hasServerFilters = Object.keys(serverFilters).length > 0
    const hasServerSettings = Object.keys(serverSettings).length > 0

    return {
      ...pipeline,
      filters: hasServerFilters ? serverFilters : (extra?.filters ?? {}),
      settings: {
        ...(hasServerSettings ? serverSettings : extra?.settings),
      },
    };
  }, []);

  const refreshPipelines = useCallback(async () => {
    invalidatePipelinesListCache()
    const data = await listPipelines()
    const extras = readLocalExtras()
    const merged = dedupePipelinesByName(
      data.map((pipeline) => normalizePipelineForUi(pipeline, extras[pipeline.id]))
    )
    setPipelines(merged)
    return merged
  }, [normalizePipelineForUi, readLocalExtras])

  const loadPipelines = useCallback(async () => {
    try {
      await refreshPipelines()
    } catch (error) {
      console.error("Failed to load pipelines:", error);
      // Keep whatever stale pipelines were already seeded from localStorage
    }
  }, [refreshPipelines]);

  useEffect(() => {
    loadPipelines();
  }, [loadPipelines]);


  const handleSelectPipeline = (pipelineId: string) => {
    if (pipelineId === "none") {
      setSelectedPipelineId(null);
      onLoadPipeline({});
      onPipelineChange?.(null);
      return;
    }

    const pipeline = pipelines.find((p: Pipeline) => p.id === pipelineId);
    if (pipeline) {
      setSelectedPipelineId(pipelineId);
      onLoadPipeline(pipeline.filters ?? Object.create(null));
      onPipelineChange?.(pipeline);
    }
  };


  const handleSavePipeline = async (name: string, options?: { overwriteIfExists?: boolean }) => {
    try {
      const normalizedName = name.trim().toLowerCase()
      const mergedFilters = {
        ...currentFilters,
      };
      const mergedCombinatoricFlags = {
        ...(currentSettings?.combinatoric_flags ?? {}),
      };
      const mergedFilterModes = Object.keys(mergedFilters).reduce(
        (acc, key) => {
          const isCombinatoric = mergedCombinatoricFlags[key] ?? true;
          acc[key] = isCombinatoric ? "combinatoric" : "subset";
          return acc;
        },
        {} as Record<string, "combinatoric" | "subset">
      );
      const baseSettings = { ...((currentSettings ?? {}) as Record<string, unknown>) };
      delete (baseSettings as { combinatoric_flags?: unknown }).combinatoric_flags;
      delete (baseSettings as { filter_modes?: unknown }).filter_modes;
      delete (baseSettings as { universal_filters?: unknown }).universal_filters;
      delete (baseSettings as { filter_settings?: unknown }).filter_settings;
      const payload = {
        name,
        filters: mergedFilters,
        adjusters: currentAdjusters,
        settings: {
          ...baseSettings,
          filter_settings: mergedFilterModes,
        },
      };

      let newPipeline: Pipeline;
      const shouldOverwrite = options?.overwriteIfExists ?? true;
      invalidatePipelinesListCache()
      const latest = await listPipelines();
      if (shouldOverwrite) {
        const existingCandidates = latest.filter((pipeline) => String(pipeline.name ?? "").trim().toLowerCase() === normalizedName);
        const existing = existingCandidates.sort((a, b) => {
          const aTs = Date.parse(String(a.updated_at ?? a.created_at ?? ""));
          const bTs = Date.parse(String(b.updated_at ?? b.created_at ?? ""));
          return (Number.isFinite(bTs) ? bTs : 0) - (Number.isFinite(aTs) ? aTs : 0);
        })[0];
        if (existing?.id) {
          newPipeline = await updatePipeline(existing.id, payload);
        } else {
          newPipeline = await createPipeline(payload);
        }

        const duplicateIds = existingCandidates
          .map((pipeline) => pipeline.id)
          .filter((pipelineId) => pipelineId && pipelineId !== newPipeline.id)

        if (duplicateIds.length > 0) {
          await Promise.allSettled(duplicateIds.map((pipelineId) => deletePipeline(pipelineId)))
        }
      } else {
        newPipeline = await createPipeline(payload);
      }
      const extras = readLocalExtras();
      extras[newPipeline.id] = {
        filters: mergedFilters,
        settings: {
          ...baseSettings,
          filter_settings: mergedFilterModes,
        } as Record<string, unknown>,
      };
      writeLocalExtras(extras);
      await refreshPipelines()
      setSelectedPipelineId(newPipeline.id);
      toast.success("Pipeline saved", {
        description: `Saved ${newPipeline.name || "pipeline"}.`,
      })
    } catch (error) {
      console.error("Failed to save pipeline:", error);
      throw error;
    }
  };

  const selectedPipeline = pipelines.find((p: Pipeline) => p.id === selectedPipelineId);

  const handleDeletePipeline = async () => {
    if (!selectedPipelineId || !selectedPipeline) return;
    const selectedName = String(selectedPipeline.name ?? "").trim().toLowerCase()

    invalidatePipelinesListCache()
    const latest = await listPipelines()
    const matchingIds = latest
      .filter((pipeline) => String(pipeline.name ?? "").trim().toLowerCase() === selectedName)
      .map((pipeline) => pipeline.id)

    if (matchingIds.length === 0) {
      matchingIds.push(selectedPipelineId)
    }

    await Promise.all(matchingIds.map((pipelineId) => deletePipeline(pipelineId)));
    setDeleteDialogOpen(false)

    const extras = readLocalExtras();
    let extrasChanged = false
    for (const pipelineId of matchingIds) {
      if (!extras[pipelineId]) continue
      delete extras[pipelineId]
      extrasChanged = true
    }
    if (extrasChanged) {
      writeLocalExtras(extras)
    }

    await refreshPipelines()
    setSelectedPipelineId(null);
    onLoadPipeline({
      competitors: [],
      locations: [],
      dimensions: [],
      unit_categories: [],
    });
    onPipelineChange?.(null);
    toast.success("Pipeline deleted", {
      description: `Removed ${selectedPipeline.name || "pipeline"}.`,
    })
  };
  const sortedPipelines = useMemo(() => {
    const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
    return [...pipelines].sort((a, b) => {
      const aName = String(a.name ?? "").trim();
      const bName = String(b.name ?? "").trim();
      const cmp = collator.compare(aName, bName);
      return nameSortDirection === "asc" ? cmp : -cmp;
    });
  }, [nameSortDirection, pipelines]);

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
          <div className="flex items-center justify-end border-b px-1 py-1">
            <Button
              variant="ghost"
              size="icon"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setNameSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
              aria-label={nameSortDirection === "asc" ? "Sort pipelines Z to A" : "Sort pipelines A to Z"}
              title={nameSortDirection === "asc" ? "Sorted A to Z. Click to sort Z to A" : "Sorted Z to A. Click to sort A to Z"}
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>
          <SelectItem value="none">
            <span className="text-muted-foreground">No pipeline</span>
          </SelectItem>
          {sortedPipelines.map((pipeline: Pipeline) => (
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
