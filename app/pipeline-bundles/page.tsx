"use client";
import { useEffect, useMemo, useState } from "react";
import type { Pipeline, PricingSnapshot, PricingDataResponse, ColumnStatistics } from "@/lib/api/types";
import { PricingOverview } from "../pricing/components/pricing-overview";
import { listPipelines } from "@/lib/api/client/pipelines";
import { getPricingSnapshots, getPricingData, getColumnStatistics } from "@/lib/api/client/pricing";
export default function PipelineBundlesPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineIds, setSelectedPipelineIds] = useState<string[]>([]);

  useEffect(() => {
    listPipelines().then(setPipelines);
  }, []);

  // Selected pipeline objects
  const [snapshots, setSnapshots] = useState<PricingSnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string>("latest");
  const [dataResponse, setDataResponse] = useState<PricingDataResponse | null>(null);
  const [columnsStats, setColumnsStats] = useState<Record<string, ColumnStatistics>>({});

  useEffect(() => {
    listPipelines().then(setPipelines);
    getPricingSnapshots().then(setSnapshots);
  }, []);

  useEffect(() => {
    if (!selectedSnapshot) return;
    getPricingData(selectedSnapshot).then(setDataResponse);
    getColumnStatistics(selectedSnapshot).then((stats: ColumnStatistics[]) => {
      const statsObj: Record<string, ColumnStatistics> = {};
      stats.forEach((s: ColumnStatistics) => { statsObj[s.column] = s; });
      setColumnsStats(statsObj);
    });
  }, [selectedSnapshot]);

  // Selected pipeline objects
  const selectedPipelines = useMemo(
    () => selectedPipelineIds.map((id) => pipelines.find((p) => p.id === id)).filter(Boolean) as Pipeline[],
    [selectedPipelineIds, pipelines]
  );

  // All pipelines not selected are eligible
  const eligiblePipelines = useMemo(
    () => pipelines.filter((p) => !selectedPipelineIds.includes(p.id)),
    [pipelines, selectedPipelineIds]
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-4 sm:space-y-5">
      <h1 className="text-2xl font-bold mb-6">Pipeline Bundles</h1>
      <div className="mb-8 text-muted-foreground">
        Create and manage bundles of pipelines. Select any pipelines to combine. Pipeline settings are only editable in the Pipelines tab.
      </div>
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
          <label className="block mb-2 font-medium">Available pipelines:</label>
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
              <div className="text-muted-foreground">No pipelines available.</div>
            )}
          </div>
        </div>
      </main>
    );
  }
