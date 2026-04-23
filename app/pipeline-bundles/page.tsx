
"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listPipelines } from "@/lib/api/client/pipelines";
import type { Pipeline } from "@/lib/api/types";
import { useEffect, useMemo, useState } from "react";



// Utility: get combinatoric filter keys
const COMBINATORIC_KEYS = [
  "competitors",
  "locations",
  "dimensions",
  "unit_categories",
];


function getCombinatoricValues(pipeline: Pipeline): Record<string, string[]> {
  const filters = pipeline.settings?.universal_filters ?? {};
  const filtersObj = filters as Record<string, unknown>;
  const result: Record<string, string[]> = {};
  for (const key of COMBINATORIC_KEYS) {
    const val = filtersObj[key];
    result[key] = Array.isArray(val) ? (val as string[]) : [];
  }
  return result;
}

// Helper: Cartesian product of arrays
function cartesianProduct<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>(
    (acc, curr) =>
      acc
        .map((x) => curr.map((y) => x.concat([y])))
        .reduce((a, b) => a.concat(b), []),
    [[]]
  );
}

// Helper: Generate all combinatoric tuples for a pipeline
function getCombinatoricTuples(pipeline: Pipeline): string[][] {
  const values = getCombinatoricValues(pipeline);
  const arrays = COMBINATORIC_KEYS.map((key) => values[key].length ? values[key] : ["__ANY__"]);
  return cartesianProduct(arrays);
}

// (Removed duplicate pipelinesIntersect definition)

function pipelinesIntersect(a: Pipeline, b: Pipeline): boolean {
  const aVals = getCombinatoricValues(a);
  const bVals = getCombinatoricValues(b);
  for (const key of COMBINATORIC_KEYS) {
    if (aVals[key].length === 0 || bVals[key].length === 0) continue;
    if (aVals[key].some((val) => bVals[key].includes(val))) {
      return true;
    }
  }
  return false;
}

export default function PipelineBundlesPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);

  useEffect(() => {
    listPipelines().then(setPipelines);
  }, []);

  const selectedPipeline = useMemo(
    () => pipelines.find((p) => p.id === selectedPipelineId) || null,
    [selectedPipelineId, pipelines]
  );

  // Filter eligible pipelines: only those that do NOT intersect with the selected one
  const eligiblePipelines = useMemo(() => {
    if (!selectedPipeline) return pipelines;
    return pipelines.filter((p) => p.id === selectedPipeline.id || !pipelinesIntersect(selectedPipeline, p));
  }, [pipelines, selectedPipeline]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-4 sm:space-y-5">
      <h1 className="text-2xl font-bold mb-6">Pipeline Bundles</h1>
      <div className="mb-8 text-muted-foreground">
        Create and manage bundles of pipelines. Select pipelines to combine as long as their filters do not conflict. Pipeline settings are only editable in the Pipelines tab.
      </div>
      <div className="mb-6">
        <label className="block mb-2 font-medium">Select a pipeline:</label>
        <Select value={selectedPipelineId || ""} onValueChange={setSelectedPipelineId}>
          <SelectTrigger className="w-[320px]">
            <SelectValue placeholder="Choose pipeline..." />
          </SelectTrigger>
          <SelectContent>
            {pipelines.map((pipeline) => (
              <SelectItem key={pipeline.id} value={pipeline.id}>
                {pipeline.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="mb-6">
        <label className="block mb-2 font-medium">Eligible pipelines to bundle:</label>
        <div className="max-h-64 overflow-y-auto border rounded-lg bg-background/50 p-4">
          {selectedPipeline ? (
            eligiblePipelines.length > 1 ? (
              <ul className="space-y-2">
                {eligiblePipelines
                  .filter((p) => p.id !== selectedPipeline.id)
                  .map((p) => (
                    <li key={p.id} className="py-1 px-2 rounded hover:bg-accent cursor-pointer">
                      {p.name}
                    </li>
                  ))}
              </ul>
            ) : (
              <div className="text-muted-foreground">No eligible pipelines available for bundling.</div>
            )
          ) : (
            <div className="text-muted-foreground">Select a pipeline to see eligible bundles.</div>
          )}
        </div>
      </div>
    </main>
  );
}
