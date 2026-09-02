# Changelog

## [Unreleased] — 2026-09-02

### Context

Business report: the pricing snapshot load took 10-20s and the UI hung with no feedback. After evaluating a backend fix, the request was ultimately to solve this purely through frontend orchestration, replicating the explicit-action + spinner pattern from Pipelines/Bundles, without touching the backend.

### Changed

- **`app/pricing/page.tsx`**
  - Replaced the two-stage fetch (`INITIAL_LOAD_LIMIT=250` → `FULL_LOAD_LIMIT=1000` in the background, with a "Refreshing…" banner) with a single call to `getPricingData(snapshot, { limit: 1000 })`, gated behind an explicit **"Calculate"** button (`Loader2` spinner + `disabled` while loading).
    - *Rationale*: the request to "populate things immediately... calculate button... for pricing page" — move the one genuinely heavy call off the page's critical load path and put it behind an explicit user action.
  - `columnsStats` (column type badges) are now requested in their own effect (`loadColumnStats`), triggered only by `selectedSnapshot`, no longer dependent on the row-level data finishing its load.
    - *Rationale*: "snapshot values visible instantly, all but the data" — type badges aren't "the data" (the raw table), so they shouldn't wait on it.
  - New `hasCalculated`/`calculating` state; the table's empty row now distinguishes three cases: never calculated, calculating, no results after filtering.
    - *Rationale*: UI support needed so the button gate doesn't leave the table blank with no explanation.

- **`app/pricing/components/pricing-overview.tsx`**
  - Rows/Facilities/Columns are now read first from the matching entry in the already-loaded snapshot list (`snapshots.find(s => s.date === selectedSnapshot)`), falling back to `dataResponse` if there's no match.
    - *Rationale*: those three values were already included in `getPricingSnapshots()` — a lightweight, independent fetch already firing on page mount — so there was no real reason to wait on the heavy row-level fetch just to display them.
  - Side effect: since this component is shared, Pipelines and Pipeline Bundles inherit the same improvement without any code changes on those pages.

- **`app/pipelines/page.tsx`**
  - Same `columnsStats` decoupling as on Pricing (its own effect; no longer depends on `fullRes.columns` from Stage 2 of the data fetch).
    - *Rationale*: explicit request "pipeline values immediately visible, snapshot values visible instantly, all but the data" — no button added, since the client decided to limit the button gate to Pricing only (see Scope decisions).
  - No change to the automatic loading of the data table (Stage 1 at `limit=250`, Stage 2a/2b in the background at `limit=1000`) — stays exactly as before.

### Scope decisions

- The backend's pagination cap (`limit <= 1000` on `GET /pricing-data/{snapshot}`, FastAPI validation) was left untouched. "No pagination" was interpreted as *a single call at the maximum allowed* rather than literally removing the limit — since not touching the backend was an explicit requirement.
- The "Calculate" button was not replicated on Pipelines or Pipeline Bundles. The initial premise that those pages "already had" this pattern turned out to be incorrect (Pipelines recomputes automatically via `useMemo`, no button; Bundles' "Apply Pricing" button gates processing of an uploaded CSV, not snapshot data loading) — verified in the code, and the client confirmed leaving those two pages with their current automatic loading.
- Pipeline Bundles: no code changes. Instant loading of a saved config (adjusters/mapping/standard rate formula on selection) was already synchronous before this iteration — behavior was verified, nothing was modified.

### Verified

- `npm run type-check` and `npm run lint`: clean, no errors or warnings.
- Functional verification with headless Playwright against the app running locally: the Calculate button starts in prompt state, shows a spinner on click, and fires the expected network call (`GET /competitors/pricing-data/{snapshot}?limit=1000`). Could not validate end-to-end with real data on this machine due to a local SSL certificate error talking to S3 — pre-existing, unrelated to this change.

### Requirements and implementation

Requirements as they arrived (base deliverables + handwritten annotations on that table). For each one, status and how it was resolved in this set of changes:

| # | Requirement | Status | How it was resolved |
|---|---|---|---|
| 1 | Saved config visible immediately in Bundles — load a config and see adjusters/mapping/standard rate formula applied instantly | ✅ Already met, no new code | Verified in `process-csv-button.tsx`: `handleSelectProcessCsvConfig` was already synchronous (no fetch on selection); the only network call is the config list, which already happens when the dialog opens, before anything is picked. No changes required. |
| 2 | "Pipeline values immediately visible" (Pipelines) | ✅ Already met, no new code | `GET /pipelines` and selecting a saved pipeline were already independent of the heavy row-level fetch — purely synchronous state assignment. |
| 3 | "Snapshot values visible instantly, all but the data" (Pipelines) | ✅ Implemented | `columnsStats` decoupled from the row-level fetch in `app/pipelines/page.tsx` (see *Changed* above); Overview (Rows/Facilities/Columns) decoupled via `pricing-overview.tsx`. |
| 4 | No pagination — load all data on the same page, client-side filters | ⚠️ Met with an agreed caveat | The backend's 1000-row cap was kept as-is (not touching the backend was an explicit requirement) — this became a single call at the maximum allowed, not a removed limit. Filters were already 100% client-side, no changes. |
| 5 | Calculate button on Pricing "like Bundles and Pipelines already have" | ✅ Implemented on Pricing — with a corrected premise | Button added in `app/pricing/page.tsx`. Investigation showed Bundles/Pipelines didn't actually have that pattern (see *Scope decisions*) — flagged to the client before implementing. |
| 6 | Pattern applied consistently across pricing, pipelines, and bundles | ⚠️ Scope reduced by client decision | The button stayed on Pricing only. Pipelines/Bundles inherited the Overview/column-stats decoupling by virtue of the shared component, but not the button gate. |
