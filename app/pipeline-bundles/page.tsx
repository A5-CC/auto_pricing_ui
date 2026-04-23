"use client";
import { CalculatedPrice } from "@/components/pipelines/calculated-price";
import { listPipelines } from "@/lib/api/client/pipelines";
import { getColumnStatistics, getPricingData, getPricingSnapshots } from "@/lib/api/client/pricing";
import type { ColumnStatistics, Pipeline, PricingDataResponse, PricingSnapshot } from "@/lib/api/types";
import { useEffect, useMemo, useState } from "react";
import { PricingOverview } from "../pricing/components/pricing-overview";
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

      {/* Stacked pipeline tables */}
      {selectedPipelines.length > 0 && (
        <section className="space-y-12 mt-12">
          {selectedPipelines.map((pipeline) => {
            const adjusters = pipeline.adjusters || [];
            const settings = pipeline.settings || {};
            // Defensive extraction and type casting for settings fields
            const filters = (settings.universal_filters as Record<string, any>) || {};
            const combinatoricFlags = (settings.combinatoric_flags as Record<string, boolean>) || {};
            const rounding = (settings.rounding as { enabled?: boolean; offset?: number }) || {};
            const roundingEnabled = Boolean(rounding.enabled);
            const roundingOffset = Number(rounding.offset ?? 0);

            return (
              <div key={pipeline.id} className="border rounded-lg bg-background/50 p-6">
                <h2 className="text-xl font-semibold mb-2">{pipeline.name}</h2>
                {/* Optionally, add summary numbers here if needed */}
                <CalculatedPrice
                  competitorData={dataResponse?.data || []}
                  clientAvailableUnits={0}
                  adjusters={adjusters}
                  currentDate={new Date()}
                  filters={filters as any}
                  combinatoricFlags={combinatoricFlags as any}
                  roundingEnabled={roundingEnabled}
                  roundingOffset={roundingOffset}
                />
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
