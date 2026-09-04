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
import { Loader2 } from "lucide-react";
import { Fragment, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { PricingFilters } from "./components/pricing-filters";
import { PricingOverview } from "./components/pricing-overview";

const FULL_LOAD_LIMIT = 1000
const DEFAULT_COLUMN_WIDTH = 180
const MIN_COLUMN_WIDTH = 120

export default function PricingPage() {
  const [snapshots, setSnapshots] = useState<PricingSnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string>("latest");
  const [calculating, setCalculating] = useState(false);
  const [hasCalculated, setHasCalculated] = useState(false);
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
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    competitor_name: 280,
    client_location: 240,
    unit_dimensions: 180,
  })
  const resizeStateRef = useRef<{ columnId: string; startX: number; startWidth: number } | null>(null)

  const getColumnWidth = useCallback((columnId: string) => {
    return columnWidths[columnId] ?? DEFAULT_COLUMN_WIDTH
  }, [columnWidths])

  const getColumnCellStyle = useCallback((columnId: string) => {
    const width = getColumnWidth(columnId)
    return { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }
  }, [getColumnWidth])

  const handleResizeStart = useCallback((columnId: string, startX: number, startWidth: number) => {
    resizeStateRef.current = { columnId, startX, startWidth }
  }, [])

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      const state = resizeStateRef.current
      if (!state) return
      const delta = event.clientX - state.startX
      const nextWidth = Math.max(MIN_COLUMN_WIDTH, Math.round(state.startWidth + delta))
      setColumnWidths((prev) => ({ ...prev, [state.columnId]: nextWidth }))
    }

    const onMouseUp = () => {
      resizeStateRef.current = null
    }

    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }
  }, [])

  // Client-side filtering (generic filters). Deferred so that typing/toggling in
  // a filter keeps the control responsive — the (potentially 1000-row) refilter
  // runs at a lower priority instead of blocking the keystroke.
  const deferredFilters = useDeferredValue(selectedFilters)
  const filteredRows = useMemo(() => {
    const rows = dataResponse?.data ?? [] as PricingDataRow[]
    if (!rows || Object.keys(deferredFilters).length === 0) return rows
    let out: PricingDataRow[] = rows
    for (const [col, vals] of Object.entries(deferredFilters)) {
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
  }, [dataResponse, deferredFilters])

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

  // Filter columns based on sparse threshold (unless toggle is on).
  // While columnsStats is still loading (empty object) show everything so the
  // table isn't blank — sparse columns get quietly hidden once stats arrive.
  const displayColumns = useMemo(() => {
    if (showSparseColumns) return visibleColumns;
    if (Object.keys(columnsStats).length === 0) return visibleColumns;

    return visibleColumns.filter(col => {
      const stats = columnsStats[col];
      // Show if stats missing (newly discovered column) or fill-rate is sufficient
      return !stats || stats.fill_rate >= sparseThreshold;
    });
  }, [visibleColumns, columnsStats, showSparseColumns, sparseThreshold]);

  // Progressive row rendering: mounting ~1000 <tr> in one commit blocks the main
  // thread for hundreds of ms right after Calculate. Render a first slice, then
  // top up one chunk per animation frame until the whole set is on screen. The
  // grouped view renders its own way (and is already chunked by collapsed
  // groups), so it opts out and shows everything.
  const ROW_RENDER_INITIAL = 150;
  const ROW_RENDER_STEP = 200;
  const [rowRenderLimit, setRowRenderLimit] = useState(ROW_RENDER_INITIAL);

  useEffect(() => {
    setRowRenderLimit(ROW_RENDER_INITIAL);
  }, [dataResponse, deferredFilters, groupBy, sortBy, sortDir]);

  useEffect(() => {
    if (groupBy) return;
    if (rowRenderLimit >= displayedRows.length) return;
    const id = requestAnimationFrame(() => {
      setRowRenderLimit((n) => Math.min(n + ROW_RENDER_STEP, displayedRows.length));
    });
    return () => cancelAnimationFrame(id);
  }, [groupBy, rowRenderLimit, displayedRows.length]);

  const cappedRows = useMemo(
    () => displayedRows.slice(0, rowRenderLimit),
    [displayedRows, rowRenderLimit]
  );

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

  // Column statistics (type badges) only need the snapshot + schema, not the
  // row-level data — fetch them independently so they don't wait on Calculate.
  const loadColumnStats = useCallback(async () => {
    try {
      const stats = await getColumnStatistics(selectedSnapshot);
      const byName = Object.fromEntries(stats.map((s) => [s.column, s]));
      setColumnsStats(byName);
    } catch {
      // Type badges just won't show; not worth surfacing an error for this.
    }
  }, [selectedSnapshot]);

  useEffect(() => {
    setColumnsStats({});
    loadColumnStats();
  }, [loadColumnStats]);

  // The row-level table is the one genuinely heavy call. It no longer fires
  // automatically — it's gated behind the "Calculate" button so the rest of
  // the page (snapshot picker, Overview stats, column-type badges) is never
  // blocked on it. Reset to the empty/prompt state whenever the snapshot
  // changes, so stale rows from a previous snapshot are never shown as current.
  useEffect(() => {
    setDataResponse(null);
    setHasCalculated(false);
    setVisibleColumns([]);
    setError(null);
  }, [selectedSnapshot]);

  const handleCalculate = useCallback(async () => {
    const loadId = ++activeLoadRef.current;
    setError(null);
    setCalculating(true);
    try {
      const res = await getPricingData(selectedSnapshot, { limit: FULL_LOAD_LIMIT });
      if (loadId !== activeLoadRef.current) return;

      setDataResponse(res);
      setHasCalculated(true);
      if (res.columns?.length) {
        const fixedColumns = [
          "competitor_name",
          "competitor_address",
          "client_location",
          "snapshot_date",
          "unit_dimensions",
        ];
        setVisibleColumns(res.columns.filter((col) => !fixedColumns.includes(col)));
      }
    } catch {
      if (loadId !== activeLoadRef.current) return;
      setError("Failed to load pricing data");
    } finally {
      if (loadId === activeLoadRef.current) setCalculating(false);
    }
  }, [selectedSnapshot]);

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
            <Button
              size="sm"
              onClick={handleCalculate}
              disabled={!selectedSnapshot || calculating}
            >
              {calculating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {calculating ? "Calculating…" : "Calculate"}
            </Button>
          </div>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCalculate}
              disabled={calculating}
            >
              Retry
            </Button>
          </AlertDescription>
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
                { id: "client_location", label: getCanonicalLabel("client_location", pricingSchemas) },
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
                  onResizeStart={handleResizeStart}
                  width={getColumnWidth("competitor_name")}
                  minWidth={MIN_COLUMN_WIDTH}
                  className="px-4 py-2"
                />
                <SortableTh
                  columnId="client_location"
                  label={getCanonicalLabel("client_location", pricingSchemas)}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSortClick={handleSortClick}
                  onResizeStart={handleResizeStart}
                  width={getColumnWidth("client_location")}
                  minWidth={MIN_COLUMN_WIDTH}
                  className="px-4 py-2"
                />
                <SortableTh
                  columnId="unit_dimensions"
                  label={getCanonicalLabel("unit_dimensions", pricingSchemas)}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSortClick={handleSortClick}
                  onResizeStart={handleResizeStart}
                  width={getColumnWidth("unit_dimensions")}
                  minWidth={MIN_COLUMN_WIDTH}
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
                    onResizeStart={handleResizeStart}
                    width={getColumnWidth(c)}
                    minWidth={MIN_COLUMN_WIDTH}
                    className="px-4 py-2 align-top"
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {groupBy && grouped ? (
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
                          <td className="px-4 py-2 whitespace-nowrap" style={getColumnCellStyle("competitor_name")}>
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
                          <td className="px-4 py-2" style={getColumnCellStyle("client_location")}>
                            <AddressCell address={row.client_location} />
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap" style={getColumnCellStyle("unit_dimensions")}>
                            {row.unit_dimensions || "—"}
                          </td>
                          {displayColumns.map((c) => (
                            <td key={`${idx}-${c}`} className="px-4 py-2 align-top whitespace-normal break-words" style={getColumnCellStyle(c)}>
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
                <>
                {cappedRows.map((row, idx) => (
                  <tr
                    key={`${row.client_location}-${idx}`}
                    className="border-t align-top"
                  >
                    <td className="px-4 py-2 whitespace-nowrap" style={getColumnCellStyle("competitor_name")}>
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
                    <td className="px-4 py-2" style={getColumnCellStyle("client_location")}>
                      <AddressCell address={row.client_location} />
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap" style={getColumnCellStyle("unit_dimensions")}>
                      {row.unit_dimensions || "—"}
                    </td>
                    {displayColumns.map((c) => (
                      <td key={`${idx}-${c}`} className="px-4 py-2 align-top whitespace-normal break-words" style={getColumnCellStyle(c)}>
                        <TableCell
                          value={row[c]}
                          type={columnsStats[c]?.data_type}
                          columnId={c}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
                {!groupBy && displayedRows.length > rowRenderLimit && (
                  <tr>
                    <td
                      className="px-4 py-3 text-center text-xs text-muted-foreground"
                      colSpan={3 + (displayColumns.length || 0)}
                    >
                      Rendering rows… {rowRenderLimit.toLocaleString()} /{" "}
                      {displayedRows.length.toLocaleString()}
                    </td>
                  </tr>
                )}
                </>
              ) : (
                <tr>
                  <td
                    className="px-4 py-6 text-center text-muted-foreground"
                    colSpan={3 + (displayColumns.length || 0)}
                  >
                    {calculating
                      ? "Loading pricing data…"
                      : !hasCalculated
                      ? "Click Calculate to load pricing data for this snapshot."
                      : "No results. Broaden filters."}
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
