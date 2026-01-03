"use client";

import { useEffect, useMemo, useState } from "react";

import type { Adjuster } from "@/lib/adjusters";
import type { E1DataRow } from "@/lib/api/types";

import { getE1Competitors, getE1Client } from "@/lib/api/client/pipelines";

import { PricingFilters } from "../pricing/components/pricing-filters";
import { AdjustersList } from "@/components/pipelines/adjusters-list";
import { CalculatedPrice } from "@/components/pipelines/calculated-price";

import { useCompetitorFilter } from "@/hooks/useCompetitorFilter";
import { useLocationFilter } from "@/hooks/useLocationFilter";
import { useDimensionsFilter } from "@/hooks/useDimensionsFilter";
import { useUnitCategoryFilter } from "@/hooks/useUnitCategoryFilter";

export default function PipelinesPage() {
  const [adjusters, setAdjusters] = useState<Adjuster[]>([]);

  const [competitorRows, setCompetitorRows] = useState<E1DataRow[]>([]);
  const [clientRows, setClientRows] = useState<E1DataRow[]>([]);

  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>([]);
  const [selectedUnitCategories, setSelectedUnitCategories] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      const competitors = await getE1Competitors("latest", { limit: 10000 });
      const client = await getE1Client("latest", { limit: 10000 });

      setCompetitorRows(competitors.data);
      setClientRows(client.data);
    }

    load().catch(console.error);
  }, []);

  const { filteredRows: competitorsAfterFilter, allCompetitors } =
    useCompetitorFilter(competitorRows, selectedCompetitors);

  const { filteredRows: locationsAfterFilter, allLocations } =
    useLocationFilter(competitorsAfterFilter, selectedLocations);

  const { filteredRows: dimensionsAfterFilter, allDimensions } =
    useDimensionsFilter(locationsAfterFilter, selectedDimensions);

  const { filteredRows: fullyFilteredRows, allUnitCategories } =
    useUnitCategoryFilter(dimensionsAfterFilter, selectedUnitCategories);

  const currentDate = useMemo(() => new Date(), []);

  const handleRemoveAdjuster = (index: number) => {
    setAdjusters(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <main className="mx-auto max-w-7xl p-6 space-y-6">
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
        adjusters={adjusters}
        onRemoveAdjuster={handleRemoveAdjuster}
        resultCard={
          <CalculatedPrice
            variant="inline"
            competitorData={fullyFilteredRows}
            clientAvailableUnits={clientRows.length}
            adjusters={adjusters}
            currentDate={currentDate}
          />
        }
      />
    </main>
  );
}
