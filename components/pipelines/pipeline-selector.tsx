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




interface PipelineSelectorProps {
  currentFilters: Record<string, string[]>;
  currentAdjusters: Adjuster[];
  currentSettings?: {
    universal_filters?: Record<string, string[]>;
    [key: string]: any;
  };
  onLoadPipeline: (filters: Record<string, string[]>) => void;
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


  // No-op for local extras, as filters/settings are now only universal_filters
  const readLocalExtras = useCallback(() => {
    if (typeof window === "undefined") return {} as Record<string, { filters: Record<string, string[]>; settings?: Record<string, unknown> }>;
    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, { filters: Record<string, string[]>; settings?: Record<string, unknown> }>;
    } catch {
      return {} as Record<string, { filters: Record<string, string[]>; settings?: Record<string, unknown> }>;
    }
  }, []);

  const writeLocalExtras = useCallback((extras: Record<string, { filters: Record<string, string[]>; settings?: Record<string, unknown> }>) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(extras));
    } catch {
      // ignore
    }
  }, []);

  // Normalize pipeline for UI: just pass universal_filters
  const normalizePipelineForUi = useCallback((
    pipeline: Pipeline,
    extra?: { filters: Record<string, string[]>; settings?: Record<string, unknown> }
  ): Pipeline => {
    const mergedUniversalFilters = {
      ...(pipeline.settings?.universal_filters ?? {}),
      ...(extra?.settings?.universal_filters ?? {}),
    };
    return {
      ...pipeline,
      settings: {
        ...pipeline.settings,
        ...extra?.settings,
        universal_filters: mergedUniversalFilters,
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
      onLoadPipeline(pipeline.settings?.universal_filters ?? {});
      onPipelineChange?.(pipeline);
    }
  };


  const handleSavePipeline = async (name: string) => {
    try {
      const mergedUniversalFilters = {
        ...currentFilters,
        ...(currentSettings?.universal_filters ?? {}),
      };
      const newPipeline = await createPipeline({
        name,
        adjusters: currentAdjusters,
        settings: { ...currentSettings, universal_filters: mergedUniversalFilters },
      });
      const extras = readLocalExtras();
      extras[newPipeline.id] = { filters: {}, settings: { ...currentSettings, universal_filters: mergedUniversalFilters } as Record<string, unknown> };
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
