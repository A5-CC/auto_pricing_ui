
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

// Helper: Generate all combinatoric tuples for a pipeline
function getCombinatoricTuples(pipeline: Pipeline): string[][] {
  const values = getCombinatoricValues(pipeline);
  const arrays = COMBINATORIC_KEYS.map((key) => values[key].length ? values[key] : ["__ANY__"]);
  return cartesianProduct(arrays);
}

// New intersection: only if there is a full tuple match
function pipelinesIntersect(a: Pipeline, b: Pipeline): boolean {
  const aTuples = getCombinatoricTuples(a).map((tuple) => tuple.join("|"));
  const bTuples = new Set(getCombinatoricTuples(b).map((tuple) => tuple.join("|")));
  return aTuples.some((tuple) => bTuples.has(tuple));
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

// Helper: Generate all combinatoric tuples for a pipeline (used only by pipelinesIntersect)
// (No unused function warning; pipelinesIntersect uses this directly)

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

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineIds, setSelectedPipelineIds] = useState<string[]>([]);

  useEffect(() => {
    listPipelines().then(setPipelines);
  }, []);

  // Selected pipeline objects
  const selectedPipelines = useMemo(
    () => selectedPipelineIds.map((id) => pipelines.find((p) => p.id === id)).filter(Boolean) as Pipeline[],
    [selectedPipelineIds, pipelines]
  );

  // Eligible pipelines: must not intersect with ANY selected pipeline
  const eligiblePipelines = useMemo(() => {
    if (selectedPipelines.length === 0) return pipelines;
    return pipelines.filter((p) =>
      !selectedPipelineIds.includes(p.id) &&
      selectedPipelines.every((sel) => !pipelinesIntersect(sel, p))
    );
  }, [pipelines, selectedPipelineIds, selectedPipelines]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-4 sm:space-y-5">
      <h1 className="text-2xl font-bold mb-6">Pipeline Bundles</h1>
      <div className="mb-8 text-muted-foreground">
        Create and manage bundles of pipelines. Select pipelines to combine as long as their filters do not conflict. Pipeline settings are only editable in the Pipelines tab.
      </div>
      <div className="mb-6">
        <label className="block mb-2 font-medium">Selected pipelines:</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedPipelines.length === 0 && <span className="text-muted-foreground">None selected</span>}
          {selectedPipelines.map((p) => (
            <span key={p.id} className="inline-flex items-center bg-primary/10 text-primary px-3 py-1 rounded-full">
              {p.name}
              <button
                className="ml-2 text-red-500 hover:text-red-700"
                onClick={() => setSelectedPipelineIds(ids => ids.filter(id => id !== p.id))}
                title="Remove pipeline"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>
      <div className="mb-6">
        <label className="block mb-2 font-medium">Eligible pipelines to bundle:</label>
        <div className="max-h-64 overflow-y-auto border rounded-lg bg-background/50 p-4">
          {eligiblePipelines.length > 0 ? (
            <ul className="space-y-2">
              {eligiblePipelines.map((p) => (
                <li
                  key={p.id}
                  className="py-1 px-2 rounded hover:bg-accent cursor-pointer"
                  onClick={() => setSelectedPipelineIds(ids => [...ids, p.id])}
                >
                  {p.name}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-muted-foreground">No eligible pipelines available for bundling.</div>
          )}
        </div>
      </div>
    </main>
  );
}
