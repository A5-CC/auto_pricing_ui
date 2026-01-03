"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getE1Snapshots,
  getE1Competitors,
  getE1Client,
  // exportE1CompetitorsCSV,
  getE1CompetitorsStatistics,
} from "@/lib/api/client/pipelines";
import { getPricingSchemas } from "@/lib/api/client/pricing";
import type {
  E1Snapshot,
  E1DataResponse,
  ColumnStatistics,
  PricingSchemas,
  PipelineFilters,
  Pipeline,
} from "@/lib/api/types";
// import { Button } from "@/components/ui/button";
// import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// import { Badge } from "@/components/ui/badge";
// import { Checkbox } from "@/components/ui/checkbox";
// import { Label } from "@/components/ui/label";
import { ContextChips } from "@/components/context-chips";
import { useContextChips } from "@/hooks/useContextChips";
import { SortableTh } from "@/components/table/SortableTh";
import { useSortableRows } from "@/hooks/useSortableRows";
import { useCompetitorFilter } from "@/hooks/useCompetitorFilter";
import { useLocationFilter } from "@/hooks/useLocationFilter";
import { useDimensionsFilter } from "@/hooks/useDimensionsFilter";
import { useUnitCategoryFilter } from "@/hooks/useUnitCategoryFilter";
// import GroupByControl from "@/components/pricing/group-by-control";
// import { SectionLabel } from "@/components/ui/section-label";
// import { getCompetitorColor } from "@/lib/pricing/formatters";
// import { getColumnLabel } from "@/lib/pricing/column-labels";
// import { TableCell } from "@/components/pricing/table-cell";
// import { PricingOverview } from "../pricing/components/pricing-overview";
import { PricingFilters } from "../pricing/components/pricing-filters";
// import { PipelineSelector } from "@/components/pipelines/pipeline-selector";
import { AdjustersList } from "@/components/pipelines/adjusters-list";
import { CalculatedPrice } from "@/components/pipelines/calculated-price";
// import { AddCompetitiveAdjusterDialog } from "@/components/pipelines/adjusters/add-competitive-adjuster-dialog";
// import { AddFunctionAdjusterDialog } from "@/components/pipelines/adjusters/add-function-adjuster-dialog";
// import { AddTemporalAdjusterDialog } from "@/components/pipelines/adjusters/add-temporal-adjuster-dialog";
import { useAdjusterDialog } from "@/components/pipelines/adjusters/use-adjuster-dialog";
// import { PriceDataWarning } from "@/components/pipelines/price-data-warning";
import type { Adjuster } from "@/lib/adjusters";
import { hasValidCompetitorPrices, getPriceDiagnostics } from "@/lib/adjusters";
// import { TrendingDown, Calculator, Clock, Plus } from "lucide-react";

export default function PipelinesPage() {
  const [snapshots, setSnapshots] = useState<E1Snapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string>("latest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localAdjusters, setLocalAdjusters] = useState<Adjuster[]>([]);

  const competitiveDialog = useAdjusterDialog();
  const functionDialog = useAdjusterDialog();
  const temporalDialog = useAdjusterDialog();

  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>([]);
  const [selectedUnitCategories, setSelectedUnitCategories] = useState<string[]>([]);

  const [dataResponse, setDataResponse] = useState<E1DataResponse | null>(null);
  const [clientDataResponse, setClientDataResponse] = useState<E1DataResponse | null>(null);
  const [columnsStats, setColumnsStats] = useState<Record<string, ColumnStatistics>>({});
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [pricingSchemas, setPricingSchemas] = useState<PricingSchemas | null>(null);
  const [showSparseColumns, setShowSparseColumns] = useState(false);
  const sparseThreshold = 85;

  const { filteredRows: competitorFilteredRows, allCompetitors } =
    useCompetitorFilter(dataResponse?.data ?? [], selectedCompetitors);

  const { filteredRows, allLocations } =
    useLocationFilter(competitorFilteredRows, selectedLocations);

  const { filteredRows: locationAndDimFilteredRows, allDimensions } =
    useDimensionsFilter(filteredRows, selectedDimensions);

  const { filteredRows: fullyFilteredRows, allUnitCategories } =
    useUnitCategoryFilter(locationAndDimFilteredRows, selectedUnitCategories);

  const {
    sortedRows: displayedRows,
    sortBy,
    sortDir,
    handleSortClick,
    setSortBy,
    setSortDir,
  } = useSortableRows(fullyFilteredRows, columnsStats, null, "asc");

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 25;

  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const { createChips } = useContextChips();

  const grouped = useMemo(() => {
    if (!groupBy) return null;
    const map = new Map<string, typeof displayedRows>();
    for (const row of displayedRows) {
      const raw = row[groupBy as keyof typeof row];
      const key = raw == null || raw === "" ? "—" : String(raw);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    const keys = Array.from(map.keys()).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );
    return { keys, map };
  }, [displayedRows, groupBy]);

  useEffect(() => {
    if (!groupBy) {
      setExpandedGroups(new Set());
      return;
    }
    if (grouped) setExpandedGroups(new Set(grouped.keys));
  }, [groupBy, grouped]);

  const loadSnapshots = async () => {
    try {
      setSnapshots(await getE1Snapshots());
    } catch {}
  };

  const loadSchemas = async () => {
    try {
      setPricingSchemas(await getPricingSchemas());
    } catch {}
  };

  useEffect(() => {
    loadSnapshots();
    loadSchemas();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getE1Competitors(selectedSnapshot, { limit: 10000 });
      setDataResponse(res);

      const clientRes = await getE1Client(selectedSnapshot, { limit: 10000 });
      setClientDataResponse(clientRes);

      if (res.columns?.length) {
        const stats = await getE1CompetitorsStatistics(selectedSnapshot, res.columns);
        setColumnsStats(Object.fromEntries(stats.map(s => [s.column, s])));
        setVisibleColumns(res.columns);
      }
    } catch {
      setError("Failed to load E1 data");
    } finally {
      setLoading(false);
    }
  }, [selectedSnapshot]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePipelineChange = (pipeline: Pipeline | null) => {
    setLocalAdjusters(pipeline?.adjusters ?? []);
  };

  const handleRemoveAdjuster = (index: number) => {
    setLocalAdjusters(prev => prev.filter((_, i) => i !== index));
  };

  const currentDate = useMemo(() => new Date(), []);
  const canAddAdjusters = useMemo(
    () => hasValidCompetitorPrices(fullyFilteredRows),
    [fullyFilteredRows]
  );

  return (
    <main className="mx-auto max-w-7xl p-6 space-y-5">
      <ContextChips chips={createChips({ label: "Pricing Pipelines", isCurrent: true })} />

      <PricingFilters
        selectedCompetitors={selectedCompetitors}
        setSelectedCompetitors={setSelectedCompetitors}
        allCompetitors={allCompetitors}
        selectedLocations={selectedLocations}
        setSelectedLocations={setSelectedLocations}
        allLocations={allLocations}
        selectedDimensions={selectedDimensions}
        setSelectedDimensions={setSelectedDimensions}
        allDimensions={allDimensions}
        selectedUnitCategories={selectedUnitCategories}
        setSelectedUnitCategories={setSelectedUnitCategories}
        allUnitCategories={allUnitCategories}
      />

      <AdjustersList
        adjusters={localAdjusters}
        onRemoveAdjuster={handleRemoveAdjuster}
        resultCard={
          <CalculatedPrice
            variant="inline"
            competitorData={fullyFilteredRows}
            clientAvailableUnits={clientDataResponse?.data.length || 0}
            adjusters={localAdjusters}
            currentDate={currentDate}
          />
        }
      />
    </main>
  );
}
