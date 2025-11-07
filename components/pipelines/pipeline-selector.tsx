"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SavePipelineDialog } from "./save-pipeline-dialog";
import { DeletePipelineDialog } from "./delete-pipeline-dialog";
import { listPipelines, createPipeline, deletePipeline } from "@/lib/api/client/pipelines";
import type { Pipeline, PipelineFilters } from "@/lib/api/types";
import { Save, Trash2 } from "lucide-react";

interface PipelineSelectorProps {
  currentFilters: PipelineFilters;
  onLoadPipeline: (filters: PipelineFilters) => void;
}

export function PipelineSelector({
  currentFilters,
  onLoadPipeline,
}: PipelineSelectorProps) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const loadPipelines = async () => {
    try {
      const data = await listPipelines();
      setPipelines(data);
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
      return;
    }

    const pipeline = pipelines.find((p) => p.id === pipelineId);
    if (pipeline) {
      setSelectedPipelineId(pipelineId);
      onLoadPipeline(pipeline.filters);
    }
  };

  const handleSavePipeline = async (name: string) => {
    try {
      const newPipeline = await createPipeline({
        name,
        filters: currentFilters,
      });
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
    setPipelines((prev) => prev.filter((p) => p.id !== selectedPipelineId));
    setSelectedPipelineId(null);
    onLoadPipeline({
      competitors: [],
      locations: [],
      dimensions: [],
      unit_categories: [],
    });
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
