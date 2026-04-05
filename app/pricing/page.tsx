"use client";

import { AddressCell } from "@/components/pricing/address-cell";
import GroupByControl from "@/components/pricing/group-by-control";
import { TableCell } from "@/components/pricing/table-cell";
import { SortableTh } from "@/components/table/SortableTh";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SectionLabel } from "@/components/ui/section-label";
import { useSortableRows } from "@/hooks/useSortableRows";
import {
    exportPricingCSV,
    getColumnStatistics,
    getPricingData,
    getPricingSchemas,
    getPricingSnapshots,
} from "@/lib/api/client/pricing";
import type {
    ColumnStatistics,
    PricingDataResponse,
    PricingDataRow,
    PricingSchemas,
    PricingSnapshot,
} from "@/lib/api/types";
import { getCanonicalLabel } from "@/lib/pricing/column-labels";
import { getCompetitorColor } from "@/lib/pricing/formatters";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PricingFilters } from "./components/pricing-filters";
import { PricingOverview } from "./components/pricing-overview";

const INITIAL_LOAD_LIMIT = 250
const FULL_LOAD_LIMIT = 1000

export default function PricingPage() {
  const [snapshots, setSnapshots] = useState<PricingSnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string>("latest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  
  const [dataResponse, setDataResponse] = useState<PricingDataResponse | null>(
    null
  );
  const [columnsStats, setColumnsStats] = useState<
    Record<string, ColumnStatistics>
  >({});
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [pricingSchemas, setPricingSchemas] = useState<PricingSchemas | null>(
    null
  );
  const [showSparseColumns, setShowSparseColumns] = useState(false);
  const sparseThreshold = 85; // 85% fill-rate (backend returns 0-100, not 0-1)
  const activeLoadRef = useRef(0)

  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({})

  // Client-side filtering (generic filters)
  const filteredRows = useMemo(() => {
    const rows = dataResponse?.data ?? [] as PricingDataRow[]
    if (!rows || Object.keys(selectedFilters).length === 0) return rows
    let out: PricingDataRow[] = rows
    for (const [col, vals] of Object.entries(selectedFilters)) {
      if (!vals || vals.length === 0) continue
      const sel = new Set(vals)
      out = out.filter((r) => {
        const v = r[col as keyof PricingDataRow]
        if (v === null || v === undefined) return false
        if (Array.isArray(v)) return (v as unknown[]).some(x => sel.has(String(x)))
        return sel.has(String(v))
      })
    }
    return out
  }, [dataResponse, selectedFilters])

  const {
    sortedRows: displayedRows,
    sortBy,
    sortDir,
    handleSortClick,
    setSortBy,
    setSortDir,
  } = useSortableRows(filteredRows, columnsStats, null, "asc");
  // Group by (single level)
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => {
    if (!groupBy) return null;
    const map = new Map<string, typeof displayedRows>();
    for (const row of displayedRows) {
      const raw = row[groupBy as keyof typeof row];
      const key =
        raw === null || raw === undefined || raw === "" ? "—" : String(raw);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    const keys = Array.from(map.keys()).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );
    return { keys, map };
  }, [displayedRows, groupBy]);

  // Filter columns based on sparse threshold (unless toggle is on)
  const displayColumns = useMemo(() => {
    if (showSparseColumns) return visibleColumns;

    return visibleColumns.filter(col => {
      const stats = columnsStats[col];
      // Only show columns WITH stats AND high fill rate
      return stats && stats.fill_rate >= sparseThreshold;
    });
  }, [visibleColumns, columnsStats, showSparseColumns, sparseThreshold]);

  // Auto-expand groups only when grouping mode changes
  useEffect(() => {
    if (!groupBy) {
      setExpandedGroups(new Set());
      return;
    }
    if (grouped) setExpandedGroups(new Set(grouped.keys));
  }, [groupBy, grouped]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAllGroups = () => {
    if (grouped) setExpandedGroups(new Set(grouped.keys));
  };
  const collapseAllGroups = () => setExpandedGroups(new Set());

  const loadSnapshots = async () => {
    try {
      const s = await getPricingSnapshots();
      setSnapshots(s);
    } catch {
      // silently ignore
    }
  };

  const loadSchemas = async () => {
    try {
      const schemas = await getPricingSchemas();
      setPricingSchemas(schemas);
    } catch {
      // silently ignore
    }
  };

  useEffect(() => {
    loadSnapshots();
    loadSchemas();
  }, []);

  const loadData = useCallback(async () => {
    const loadId = ++activeLoadRef.current
    setLoading(true);
    setError(null);
    setColumnsStats({})
    try {
      // Stage 1: fetch a smaller slice so the table renders quickly.
      const initialRes = await getPricingData(selectedSnapshot, { limit: INITIAL_LOAD_LIMIT });
      if (loadId !== activeLoadRef.current) return

      setDataResponse(initialRes);
      if (initialRes.columns?.length) {
        const fixedColumns = [
          "competitor_name",
          "competitor_address",
          "modstorage_location",
          "snapshot_date",
          "unit_dimensions",
        ];
        const filteredColumns = initialRes.columns.filter(
          (col) => !fixedColumns.includes(col)
        );
        setVisibleColumns((prev) => (prev.length ? prev : filteredColumns));
      }

      setLoading(false);

      // Stage 2: hydrate full data + stats in background.
      void (async () => {
        try {
          const fullRes = await getPricingData(selectedSnapshot, { limit: FULL_LOAD_LIMIT })
          if (loadId !== activeLoadRef.current) return

          setDataResponse(fullRes)

          if (fullRes.columns?.length) {
            const fixedColumns = [
              "competitor_name",
              "competitor_address",
              "modstorage_location",
              "snapshot_date",
              "unit_dimensions",
            ];
            const filteredColumns = fullRes.columns.filter(
              (col) => !fixedColumns.includes(col)
            );
            setVisibleColumns((prev) => (prev.length ? prev : filteredColumns));

            const stats = await getColumnStatistics(selectedSnapshot, fullRes.columns)
            if (loadId !== activeLoadRef.current) return
            const byName = Object.fromEntries(stats.map((s) => [s.column, s]));
            setColumnsStats(byName)
          }
        } catch {
          // Keep the initial fast load; don't block the page on background hydration errors.
        }
      })()
    } catch {
      if (loadId !== activeLoadRef.current) return
      setError("Failed to load pricing data");
      setLoading(false);
    }
  }, [selectedSnapshot]);

  // Reload when snapshot changes
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSnapshot]); // Only depend on selectedSnapshot to avoid duplicate calls

  const onExport = async () => {
    if (!selectedSnapshot) return;
    // Export via backend (full snapshot, selected columns). If needed, later we can export client-side filtered rows.
    const blob = await exportPricingCSV(selectedSnapshot, {
      columns: visibleColumns,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pricing-${selectedSnapshot}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Reset sort when dataset changes significantly (e.g., new snapshot or filters)
  useEffect(() => {
    setSortBy(null);
    setSortDir("asc");
  }, [selectedSnapshot, selectedFilters, setSortBy, setSortDir]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-4 sm:space-y-5">
      <header>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              disabled={!dataResponse}
            >
              Export CSV
            </Button>
          </div>
        </div>
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
        columnsStats={columnsStats}
        onSnapshotChange={setSelectedSnapshot}
      />

      <PricingFilters
        rows={dataResponse?.data ?? []}
        pricingSchemas={pricingSchemas}
        selectedFilters={selectedFilters}
        setSelectedFilters={setSelectedFilters}
        extraColumns={visibleColumns}
      />

      {/* Display controls */}
      <SectionLabel
        text={`Display (${(displayedRows?.length ?? 0).toLocaleString()})`}
        right={
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="show-sparse"
                checked={showSparseColumns}
                onCheckedChange={(checked) => setShowSparseColumns(checked === true)}
              />
              <Label htmlFor="show-sparse" className="text-sm font-normal cursor-pointer">
                Show sparse columns
                {!showSparseColumns && visibleColumns.length > displayColumns.length && (
                  <Badge variant="secondary" className="ml-2">
                    {visibleColumns.length - displayColumns.length} hidden
                  </Badge>
                )}
              </Label>
            </div>
            <GroupByControl
              className="min-w-[220px]"
              fullWidth={false}
              value={groupBy}
              onChange={setGroupBy}
              onExpandAll={groupBy ? expandAllGroups : undefined}
              onCollapseAll={groupBy ? collapseAllGroups : undefined}
              options={[
                { id: "competitor_name", label: getCanonicalLabel("competitor_name", pricingSchemas) },
                { id: "modstorage_location", label: getCanonicalLabel("modstorage_location", pricingSchemas) },
                { id: "unit_dimensions", label: getCanonicalLabel("unit_dimensions", pricingSchemas) },
              ]}
            />
          </div>
        }
      />

      <section className="space-y-3">
        <div className="overflow-x-auto rounded-lg border bg-card">
          <div className="min-w-[800px]">
            <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <SortableTh
                  columnId="competitor_name"
                  label={getCanonicalLabel("competitor_name", pricingSchemas)}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSortClick={handleSortClick}
                  className="px-4 py-2 w-[280px] min-w-[280px] max-w-[280px]"
                />
                <SortableTh
                  columnId="modstorage_location"
                  label={getCanonicalLabel("modstorage_location", pricingSchemas)}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSortClick={handleSortClick}
                  className="px-4 py-2 w-[240px] min-w-[240px] max-w-[240px]"
                />
                <SortableTh
                  columnId="unit_dimensions"
                  label={getCanonicalLabel("unit_dimensions", pricingSchemas)}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSortClick={handleSortClick}
                  className="px-4 py-2"
                />
                {displayColumns.map((c) => (
                  <SortableTh
                    key={c}
                    columnId={c}
                    label={getCanonicalLabel(c, pricingSchemas)}
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSortClick={handleSortClick}
                    className="px-4 py-2 whitespace-nowrap"
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="border-t">
                    <td className="px-4 py-2">
                      <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                    </td>
                    <td className="px-4 py-2">
                      <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                    </td>
                    <td className="px-4 py-2">
                      <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                    </td>
                    {Array.from({
                      length: Math.min(displayColumns.length || 6, 6),
                    }).map((_, j) => (
                      <td key={`s-${i}-${j}`} className="px-4 py-2">
                        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : groupBy && grouped ? (
                grouped.keys.map((key) => (
                  <Fragment key={`group-frag-${key}`}>
                    <tr className="border-t bg-muted/30">
                      <td
                        className="px-4 py-2"
                        colSpan={3 + (displayColumns.length || 0)}
                      >
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 font-medium text-muted-foreground hover:text-foreground"
                          onClick={() => toggleGroup(key)}
                          aria-expanded={expandedGroups.has(key)}
                          aria-controls={`group-body-${key}`}
                        >
                          <span className="inline-block h-2 w-2 rounded-full bg-border" />
                          <span className="uppercase text-[11px] tracking-wide">
                            {getCanonicalLabel(groupBy, pricingSchemas)}
                          </span>
                          <span className="text-foreground">{key}</span>
                          <span className="text-xs text-muted-foreground">
                            ({grouped.map.get(key)?.length ?? 0})
                          </span>
                        </button>
                      </td>
                    </tr>
                    {expandedGroups.has(key) &&
                      (grouped.map.get(key) ?? []).map((row, idx) => (
                        <tr
                          key={`${key}-${idx}`}
                          className="border-t align-top"
                          id={`group-body-${key}`}
                        >
                          <td className="px-4 py-2 whitespace-nowrap w-[280px] min-w-[280px] max-w-[280px]">
                            <div className="space-y-0.5">
                              <div className="flex min-w-0 items-center gap-2">
                                <span
                                  aria-hidden="true"
                                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/5"
                                  style={{
                                    backgroundColor: getCompetitorColor(
                                      String(row.competitor_name)
                                    ),
                                  }}
                                />
                                <span
                                  className="font-medium truncate"
                                  title={row.competitor_name}
                                >
                                  {row.competitor_name}
                                </span>
                              </div>
                              <div
                                className="text-xs text-muted-foreground truncate"
                                title={row.competitor_address}
                              >
                                {row.competitor_address}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <AddressCell address={row.modstorage_location} />
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            {row.unit_dimensions || "—"}
                          </td>
                          {displayColumns.map((c) => (
                            <td key={`${idx}-${c}`} className="px-4 py-2">
                              <TableCell
                                value={row[c]}
                                type={columnsStats[c]?.data_type}
                                columnId={c}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                  </Fragment>
                ))
              ) : displayedRows?.length ? (
                displayedRows.map((row, idx) => (
                  <tr
                    key={`${row.modstorage_location}-${idx}`}
                    className="border-t align-top"
                  >
                    <td className="px-4 py-2 whitespace-nowrap w-[280px] min-w-[280px] max-w-[280px]">
                      <div className="space-y-0.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/5"
                            style={{
                              backgroundColor: getCompetitorColor(
                                String(row.competitor_name)
                              ),
                            }}
                          />
                          <span
                            className="font-medium truncate"
                            title={row.competitor_name}
                          >
                            {row.competitor_name}
                          </span>
                        </div>
                        <div
                          className="text-xs text-muted-foreground truncate"
                          title={row.competitor_address}
                        >
                          {row.competitor_address}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <AddressCell address={row.modstorage_location} />
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {row.unit_dimensions || "—"}
                    </td>
                    {displayColumns.map((c) => (
                      <td key={`${idx}-${c}`} className="px-4 py-2">
                        <TableCell
                          value={row[c]}
                          type={columnsStats[c]?.data_type}
                          columnId={c}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="px-4 py-6 text-center text-muted-foreground"
                    colSpan={3 + (displayColumns.length || 0)}
                  >
                    No results. Broaden filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </section>
    </main>
  );
}
