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
import type { Pipeline, PipelineFilters, PipelineSettings } from "@/lib/api/types";
import { Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { DeletePipelineDialog } from "./delete-pipeline-dialog";
import { SavePipelineDialog } from "./save-pipeline-dialog";

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
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const readLocalExtras = () => {
    if (typeof window === "undefined") return {} as Record<string, { filters: Record<string, string[]>; settings?: PipelineSettings }>;
    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, { filters: Record<string, string[]>; settings?: PipelineSettings }>;
    } catch {
      return {} as Record<string, { filters: Record<string, string[]>; settings?: PipelineSettings }>;
    }
  };

  const writeLocalExtras = (extras: Record<string, { filters: Record<string, string[]>; settings?: PipelineSettings }>) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(extras));
    } catch {
      // ignore
    }
  };

  const loadPipelines = async () => {
    try {
      const data = await listPipelines();
      const extras = readLocalExtras();
      const merged = data.map((pipeline) => {
        const extra = extras[pipeline.id];
        if (!extra) return pipeline;
        return {
          ...pipeline,
          filters: { ...pipeline.filters, ...extra.filters },
          settings: { ...pipeline.settings, ...extra.settings },
        } as Pipeline;
      });
      setPipelines(merged);
    } catch (error) {
      console.error("Failed to load pipelines:", error);
    }
  };

  useEffect(() => {
    loadPipelines();
  }, []);

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

    const pipeline = pipelines.find((p) => p.id === pipelineId);
    if (pipeline) {
      setSelectedPipelineId(pipelineId);
      onLoadPipeline(pipeline.filters);
      onPipelineChange?.(pipeline);
    }
  };

  const handleSavePipeline = async (name: string) => {
    try {
      const rawFilters = {
        ...currentFilters,
        ...(currentSettings?.universal_filters ?? {}),
      };
      const mergedFilters = Object.fromEntries(
        Object.entries(rawFilters).filter(([, value]) => Array.isArray(value) && value.length > 0)
      ) as Record<string, string[]>;
      const newPipeline = await createPipeline({
        name,
        filters: mergedFilters,
        adjusters: currentAdjusters,
        settings: currentSettings,
      });
      const extras = readLocalExtras();
      extras[newPipeline.id] = { filters: mergedFilters, settings: currentSettings };
      writeLocalExtras(extras);
      setPipelines((prev) => [newPipeline, ...prev]);
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
    setPipelines((prev) => prev.filter((p) => p.id !== selectedPipelineId));
    setSelectedPipelineId(null);
    onLoadPipeline({
      competitors: [],
      locations: [],
      dimensions: [],
      unit_categories: [],
    });
    onPipelineChange?.(null);
  };

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId);

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
          {pipelines.map((pipeline) => (
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
