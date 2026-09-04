# Changelog

## [Unreleased] — 2026-09-04

### Context

Follow-up frontend-only performance pass on top of the 2026-09-02 work (branch `bugfix/frontend_data_loading_2`, off `a2c523c`). Goal: cut the time-to-usable page and the post-`Calculate` main-thread stall without touching the backend. Some changes were tried, found to break against the live backend, and reverted — documented below so they aren't attempted again the same way.

### Changed (shipped)

- **`app/layout.tsx`**
  - Emits `<link rel="preconnect">` + `<link rel="dns-prefetch">` for the `NEXT_PUBLIC_API_URL` origin (resolved at build time).
    - *Rationale*: the API is a raw IP behind sslip.io; doing the DNS + TLS handshake while the app JS is still parsing takes it off the critical path of the first data request.

- **`lib/api/cache.ts` + `lib/api/idb-store.ts` (new)**
  - Added an IndexedDB tier to the persistent API cache. `cachedFetch` now has an IndexedDB stale-while-revalidate branch (6h TTL) after the localStorage one; `persistWrite` writes through to both tiers; the in-memory cache is hydrated from IndexedDB once per session (fire-and-forget at module load) so the synchronous `getCachedValue()` path also serves large payloads.
    - *Rationale*: a full `pricing-data` snapshot (~1000 rows × 30-50 columns) is well over the ~5MB localStorage quota, so the existing localStorage-backed SWR silently no-op'd for exactly the payload that most needs caching — every reload paid the full recompute again.
  - `lib/api/idb-store.ts` is a dependency-free promise wrapper over IndexedDB. `openDb()` is capped at 2s and every operation degrades to a no-op / `null` when IndexedDB is unavailable (SSR prerender, blocked DB), so it can never hang a caller.
  - Strictly additive: small payloads still round-trip localStorage exactly as before.

- **`app/pricing/page.tsx`**
  - `selectedFilters` is passed through `useDeferredValue` before the (up to 1000-row) client-side refilter.
    - *Rationale*: interacting with a filter no longer blocks on the re-render; the refilter runs at a lower priority.
  - Non-grouped table body renders a 150-row slice first, then tops up 200 rows per animation frame until the full sorted/filtered set is mounted, with a `Rendering rows… N / M` line while it catches up.
    - *Rationale*: mounting ~1000 `<tr>` in one commit blocked the main thread for hundreds of ms right after `Calculate`. Grouped view is unchanged (already chunked by collapsed groups).
  - Error alert gained a **Retry** button wired to `handleCalculate`.
  - Hoisted the fixed identity-column list to a module constant (`FIXED_COLUMNS`).

- **`app/pipelines/page.tsx`**
  - `AddFunctionAdjusterDialog` is now loaded via `next/dynamic` (`ssr: false`).
    - *Rationale*: it pulls in `recharts` (the single largest chunk on the route) but only renders once the user opens it. `/pipelines` First Load JS drops from 488 kB to 382 kB with no behavior change.

### Tried and reverted

- **`min_fill_rate` on the `Calculate` request** (`getPricingData(snapshot, { limit: 1000, min_fill_rate: 0.85 })`). Intent was to have the API drop mid-fill-rate columns the client hides anyway, shrinking transfer + render.
  - *Why reverted*: on any snapshot where the identity columns (`client_location`, `competitor_name`, `competitor_address`) are under 85% filled, the backend dropped them too and then failed to read the snapshot at all — `"None of [Index(['client_location', 'competitor_name', 'competitor_address'])] are in the [columns]"`. The `min_fill_rate` query param is a 0-1 fraction with backend default 0.25; 0.85 is far too aggressive. Any future column-trimming must be proven against real snapshots first.

- **25s `AbortController` timeout in `fetchWithError`.** Intent was to turn a hung connection into an `ApiError` instead of an indefinite spinner.
  - *Why reverted*: the metadata endpoints (`/pricing-data/snapshots`, `/pricing-schemas`, `.../statistics`) currently respond in **>25s**, so the timeout cancelled slow-but-valid responses at exactly 25.00s and the pages rendered with no data. `fetchWithError` is back to a plain `fetch` with no timeout.

- **Hover/focus prefetch of pricing metadata in `components/navigation/menu-drawer.tsx`.**
  - *Why reverted*: `cachedFetch` does not dedupe in-flight requests, so the prefetch fired `getPricingSnapshots()` / `getPricingSchemas()` a second time on top of the page-mount calls — visible as duplicated `(cancelled)` request pairs. `menu-drawer.tsx` is back to the `a2c523c` baseline.

### Not attempted (deferred)

- **Service worker (SWR cache for pricing GET endpoints)**: high blast radius on a static GitHub Pages host and not verifiable from this machine (cross-origin API caching, `basePath` scope). The IndexedDB tier already covers repeat-load speed. Needs a dedicated test pass on the deployed environment.
- **Code-splitting `mathjs`**: it sits on the synchronous price-calc path in the adjuster engine; lazy-loading forces an async refactor rippling through `evaluateSafeFunction` / `validateFunctionSyntax` and every caller.
- **Server-side pre-filter by location/competitor**: the UI filters are multi-select but the API params are single-value; wiring it risks surprising refetch/reset behavior against the `Calculate` flow.
- **Idle warm-up of the heavy `pricing-data` call on the pricing page**: would hit the expensive endpoint on every visit — the server load the SOW explicitly wanted to avoid.

### Known issue (backend, not addressed here)

`/pricing-data/snapshots`, `/pricing-schemas` and `.../statistics` are responding in >25s. Backend logs show the snapshot enumeration choking on malformed snapshots (e.g. `2026-07-10-1353`, `2026-07-11-1250`: `Could not read snapshot … "None of [Index(['client_location', 'competitor_name', 'competitor_address'])] are in the [columns]"`). The reverts above mean the frontend no longer cancels or worsens these, but the page stays slow until the backend / those snapshots are fixed.

### Verified

- `npm run type-check`, `npm run lint`, `npm run build` (static export, 18 routes): clean after every commit.
- Could not validate end-to-end against the backend from this machine (pre-existing local SSL certificate error talking to S3).

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
