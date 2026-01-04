"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  getE1Snapshots,
  getE1Competitors,
  getE1Client,
} from "@/lib/api/client/pipelines";

import type {
  E1Snapshot,
  E1DataResponse,
} from "@/lib/api/types";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SectionLabel } from "@/components/ui/section-label";

import { PricingOverview } from "../pricing/components/pricing-overview";
import { PricingFilters } from "../pricing/components/pricing-filters";

import { AdjustersList } from "@/components/pipelines/adjusters-list";
import { CalculatedPrice } from "@/components/pipelines/calculated-price";

import {
  AddCompetitiveAdjusterDialog,
} from "@/components/pipelines/adjusters/add-competitive-adjuster-dialog";
import {
  AddFunctionAdjusterDialog,
} from "@/components/pipelines/adjusters/add-function-adjuster-dialog";
import {
  AddTemporalAdjusterDialog,
} from "@/components/pipelines/adjusters/add-temporal-adjuster-dialog";

import { useAdjusterDialog } from "@/components/pipelines/adjusters/use-adjuster-dialog";
import { PriceDataWarning } from "@/components/pipelines/price-data-warning";

import type { Adjuster } from "@/lib/adjusters";
import { hasValidCompetitorPrices, getPriceDiagnostics } from "@/lib/adjusters";

import { Calculator, Clock, TrendingDown, Plus } from "lucide-react";

/* ---------------- Types passed to CalculatedPrice ---------------- */

type CalcFilter =
  | { mode: "all" }
  | { mode: "subset"; values: string[] };

type CalcFiltersShape = {
  competitors: CalcFilter;
  locations: CalcFilter;
  dimensions: CalcFilter;
  unit_categories: CalcFilter;
};

/* ---------------- Page ---------------- */

export default function PipelinesPage() {
  const [snapshots, setSnapshots] = useState<E1Snapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState("latest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dataResponse, setDataResponse] = useState<E1DataResponse | null>(null);
  const [clientDataResponse, setClientDataResponse] =
    useState<E1DataResponse | null>(null);

  const [localAdjusters, setLocalAdjusters] = useState<Adjuster[]>([]);

  /* -------- Filter state -------- */

  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>([]);
  const [selectedUnitCategories, setSelectedUnitCategories] = useState<string[]>(
    []
  );

  const [competitorsAll, setCompetitorsAll] = useState(false);
  const [locationsAll, setLocationsAll] = useState(false);
  const [dimensionsAll, setDimensionsAll] = useState(false);
  const [unitCategoriesAll, setUnitCategoriesAll] = useState(false);

  /* -------- Dialogs -------- */

  const competitiveDialog = useAdjusterDialog();
  const functionDialog = useAdjusterDialog();
  const temporalDialog = useAdjusterDialog();

  /* -------- Load snapshots -------- */

  useEffect(() => {
    getE1Snapshots().then(setSnapshots).catch(() => {});
  }, []);

  /* -------- Load data -------- */

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const competitors = await getE1Competitors(selectedSnapshot, {
        limit: 10000,
      });
      const client = await getE1Client(selectedSnapshot, { limit: 10000 });

      setDataResponse(competitors);
      setClientDataResponse(client);
    } catch {
      setError("Failed to load pricing data");
    } finally {
      setLoading(false);
    }
  }, [selectedSnapshot]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* -------- Adjusters -------- */

  const handleAddAdjuster = (adjuster: Adjuster) => {
    setLocalAdjusters((prev) => [...prev, adjuster]);
  };

  const handleRemoveAdjuster = (index: number) => {
    const next = localAdjusters.filter((_, i) => i !== index);

    if (next.length && next[0].type !== "competitive") {
      toast.warning(
        "The pipeline must start with a Competitive adjuster."
      );
      return;
    }
    setLocalAdjusters(next);
  };

  /* -------- Derived -------- */

  const competitorRows = dataResponse?.data ?? [];
  const currentDate = useMemo(() => new Date(), []);

  const canAddAdjusters = useMemo(
    () => hasValidCompetitorPrices(competitorRows),
    [competitorRows]
  );

  const priceDiagnostics = useMemo(
    () => getPriceDiagnostics(competitorRows),
    [competitorRows]
  );

  /* -------- Filters passed to CalculatedPrice -------- */

  const calcFilters = useMemo<CalcFiltersShape>(
    () => ({
      competitors: competitorsAll
        ? { mode: "all" }
        : { mode: "subset", values: selectedCompetitors },
      locations: locationsAll
        ? { mode: "all" }
        : { mode: "subset", values: selectedLocations },
      dimensions: dimensionsAll
        ? { mode: "all" }
        : { mode: "subset", values: selectedDimensions },
      unit_categories: unitCategoriesAll
        ? { mode: "all" }
        : { mode: "subset", values: selectedUnitCategories },
    }),
    [
      competitorsAll,
      locationsAll,
      dimensionsAll,
      unitCategoriesAll,
      selectedCompetitors,
      selectedLocations,
      selectedDimensions,
      selectedUnitCategories,
    ]
  );

  /* ---------------- Render ---------------- */

  return (
    <main className="mx-auto max-w-7xl p-6 space-y-6">
      <header className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Build pricing pipelines using competitive, functional, and temporal
          adjusters.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {}}
          disabled
        >
          Export CSV
        </Button>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <PricingOverview
        selectedSnapshot={selectedSnapshot}
        snapshots={snapshots}
        dataResponse={dataResponse}
        columnsStats={{}}
        onSnapshotChange={setSelectedSnapshot}
      />

      <PricingFilters
        selectedCompetitors={selectedCompetitors}
        setSelectedCompetitors={setSelectedCompetitors}
        allCompetitors={[]}
        selectedLocations={selectedLocations}
        setSelectedLocations={setSelectedLocations}
        allLocations={[]}
        selectedDimensions={selectedDimensions}
        setSelectedDimensions={setSelectedDimensions}
        allDimensions={[]}
        selectedUnitCategories={selectedUnitCategories}
        setSelectedUnitCategories={setSelectedUnitCategories}
        allUnitCategories={[]}
      />

      <SectionLabel
        text="Price Calculation"
        right={
          <span className="text-xs text-muted-foreground">
            {priceDiagnostics.pricesFound}/{priceDiagnostics.competitorRows} units
            with prices
          </span>
        }
      />

      {!loading && !canAddAdjusters && (
        <PriceDataWarning competitorData={competitorRows} />
      )}

      <AdjustersList
        adjusters={localAdjusters}
        onRemoveAdjuster={handleRemoveAdjuster}
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!canAddAdjusters}
              onClick={competitiveDialog.handleOpen}
            >
              <TrendingDown className="h-4 w-4 mr-1" />
              Competitive
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!canAddAdjusters}
              onClick={functionDialog.handleOpen}
            >
              <Calculator className="h-4 w-4 mr-1" />
              Function
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!canAddAdjusters}
              onClick={temporalDialog.handleOpen}
            >
              <Clock className="h-4 w-4 mr-1" />
              Temporal
            </Button>
          </div>
        }
      />

      <CalculatedPrice
        variant="inline"
        competitorData={competitorRows}
        clientAvailableUnits={clientDataResponse?.data.length || 0}
        adjusters={localAdjusters}
        currentDate={currentDate}
        filters={calcFilters}
        maxCombinations={50}
      />

      {/* -------- Dialogs -------- */}

      <AddCompetitiveAdjusterDialog
        open={competitiveDialog.open}
        onOpenChange={competitiveDialog.setOpen}
        onAdd={handleAddAdjuster}
      />

      <AddFunctionAdjusterDialog
        open={functionDialog.open}
        onOpenChange={functionDialog.setOpen}
        onAdd={handleAddAdjuster}
        competitorData={competitorRows}
        clientAvailableUnits={clientDataResponse?.data.length || 0}
        availableVariables={[]}
      />

      <AddTemporalAdjusterDialog
        open={temporalDialog.open}
        onOpenChange={temporalDialog.setOpen}
        onAdd={handleAddAdjuster}
      />
    </main>
  );
}
