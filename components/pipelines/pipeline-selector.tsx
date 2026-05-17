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
import type { Pipeline } from "@/lib/api/types";
import { Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
      return Array.isArray(data) ? data : []
    } catch {
      return []
    }
  });
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
    const mergedFilters = {
      ...((pipeline.filters as Record<string, string[]> | undefined) ?? {}),
      ...(extra?.filters ?? {}),
    };
    return {
      ...pipeline,
      filters: mergedFilters,
      settings: {
        ...pipeline.settings,
        ...extra?.settings,
      },
    };
  }, []);

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


  const handleSavePipeline = async (name: string) => {
    try {
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
      const newPipeline = await createPipeline({
        name,
        filters: mergedFilters,
        adjusters: currentAdjusters,
        settings: {
          ...baseSettings,
          filter_settings: {
            combinatoric_flags: mergedCombinatoricFlags,
            filter_modes: mergedFilterModes,
          },
        },
      });
      const extras = readLocalExtras();
      extras[newPipeline.id] = {
        filters: mergedFilters,
        settings: {
          ...baseSettings,
          filter_settings: {
            combinatoric_flags: mergedCombinatoricFlags,
            filter_modes: mergedFilterModes,
          },
        } as Record<string, unknown>,
      };
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
