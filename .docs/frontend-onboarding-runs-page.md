# Frontend Implementation Guide: Pipeline Status Dashboard (/runs)

## Project Context

You're working on `auto_pricing_ui`, a Next.js frontend for a competitor pricing analysis system. This is a completely independent frontend that shares a backend with another project (`auto_analyst_ui`). The backend processes competitor pricing data through a two-stage pipeline: A1 (scraping) and A2 (normalization), and your task is to build the monitoring dashboard for this pipeline.

The frontend is already configured with Next.js 15, Tailwind CSS, and shadcn/ui components. It deploys automatically to GitHub Pages at `https://a5-cc.github.io/auto_pricing_ui/` whenever you push to main. The project uses TypeScript with strict mode and follows the App Router pattern (files in `app/` directory).

## Current Frontend Structure

Start by familiarizing yourself with these key files in the `auto_pricing_ui` repository:

The API client pattern is established in `lib/api/client.ts`. Look at lines 13-22 to understand the `fetchWithError` helper function that handles API calls with proper error handling. This pattern uses an `ApiError` class that preserves HTTP status codes, which you'll follow for all new API calls.

The existing UI components live in `components/ui/`. Pay special attention to `button.tsx` which provides pre-styled button variants. The default variant (lines 12-13) will be perfect for your "Run now" button, and the disabled state styling is already handled (line 8).

The environment configuration is in `.env` where `NEXT_PUBLIC_API_URL` points to the backend. During local development this is `http://localhost:8000`, but in production it's `https://18.189.253.176.sslip.io`. The API client automatically uses this environment variable.

## Backend Architecture You Need to Know

The backend (in the `AUTO_ANALYST` repository) orchestrates a data pipeline that runs daily at 3:30 AM UTC. You'll primarily interact with three endpoints that are being developed in parallel with your frontend work. While these endpoints might not be fully implemented yet, their contracts are defined and you should build against these specifications.

The pipeline works like this: First, competitor URLs are discovered and stored in S3 under `competitor-urls/`. Then the A1 stage scrapes these URLs using Firecrawl and stores raw markdown in `raw/YYYY-MM-DD/`. Finally, the A2 stage normalizes this data into structured Parquet files in `processed/`. Each run generates metadata that tracks success, failures, and timing.

You can explore the S3 structure by reading `/Users/alber/Repos/AUTO_ANALYST/.docs/data-layer/schema/s3-bucket.yaml` which documents all the prefixes and file patterns. The AWS CLI commands for exploring S3 are documented in `/Users/alber/Repos/AUTO_ANALYST/.docs/aws_cli_commands.md` if you need to verify data during development.

## Your Task: Issue #1 Implementation

Read the full Issue #1 in GitHub: `gh issue view 1 --repo A5-CC/auto_pricing_ui`. This issue asks you to build a `/runs` page that shows the pipeline status and allows manual triggering.

The page needs to display the current pipeline status (idle, running, completed, or failed) with relevant metrics like rows processed and duration. Users should see a history table of recent runs and be able to trigger new runs manually with a button that's disabled while jobs are active. The page must poll for updates every 30 seconds when a job is running.

## API Endpoints to Implement

You'll need to add three new functions to `lib/api/client.ts` following the existing pattern. Each function should use the `fetchWithError` helper and return typed responses.

First, add the TypeScript interfaces to `lib/api/types.ts`:
```typescript
export interface RunStatus {
  run_id: string
  status: 'idle' | 'running' | 'completed' | 'failed'
  started_at?: string
  finished_at?: string
  rows_processed?: number
  duration_s?: number
  failed_urls?: string[]
}

export interface RunResponse {
  run_id: string
  queued: boolean
}
```

Then implement the API client functions in `lib/api/client.ts`:
```typescript
export async function getLatestRunStatus(): Promise<RunStatus> {
  const response = await fetchWithError(`${API_BASE_URL}/competitors/run-status/latest`)
  return response.json()
}

export async function getRunHistory(): Promise<{ runs: RunStatus[] }> {
  const response = await fetchWithError(`${API_BASE_URL}/competitors/run-status/history`)
  return response.json()
}

export async function triggerPipelineRun(force = false): Promise<RunResponse> {
  const response = await fetchWithError(`${API_BASE_URL}/competitors/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force })
  })
  return response.json()
}
```

## Component Structure

Create the main page at `app/runs/page.tsx`. This should be a client component (`'use client'` directive) that manages the state for current status, history, and polling. Use React hooks: `useState` for data, `useEffect` for initial load and polling setup.

Split the UI into focused components under `components/runs/`:
- `status-header.tsx` displays the current pipeline status with a colored badge
- `run-history-table.tsx` shows the sortable table of past runs
- `run-now-button.tsx` handles the manual trigger with loading states

The status header should show different colors based on state: green badge for completed, yellow for running, red for failed, gray for idle. Use the Badge component pattern from shadcn/ui or create simple colored divs with Tailwind classes like `bg-green-500`, `bg-yellow-500`, etc.

The history table needs columns for run_id, status, started_at, duration, rows_processed, and failed_urls count. Make it responsive using Tailwind's responsive utilities. On mobile, consider stacking the information in cards instead of a table.

## Polling Implementation

Set up polling in the main page component using `useEffect` and `setInterval`. Only poll when the latest status shows 'running'. Clear the interval when status becomes idle, completed, or failed, and always clean up in the effect's return function.

Here's the polling pattern to follow:
```typescript
useEffect(() => {
  if (latestStatus?.status === 'running') {
    const interval = setInterval(async () => {
      try {
        const status = await getLatestRunStatus()
        setLatestStatus(status)
        if (status.status !== 'running') {
          // Also refresh history when job completes
          const history = await getRunHistory()
          setRunHistory(history.runs)
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }
}, [latestStatus?.status])
```

## Error Handling

Use try-catch blocks around all API calls. Display user-friendly error messages using the existing Alert component pattern or simple error divs. For network errors, show "Unable to connect to server" rather than technical error messages.

The ApiError class from `lib/api/client.ts` preserves status codes, so you can handle different errors appropriately. A 404 might mean no runs exist yet, while a 500 indicates a server problem.

## Testing Your Implementation

Start the backend locally if possible (check the AUTO_ANALYST README for instructions). The backend runs on port 8000 by default. If the endpoints aren't ready yet, you can mock them temporarily using Next.js API routes in `app/api/` for development.

Test these scenarios:
1. Page loads and displays current status
2. History table shows past runs and sorts correctly
3. "Run now" button triggers a pipeline run and becomes disabled
4. Polling starts when a run is active and stops when complete
5. Error states display appropriately when the backend is unavailable

Use the browser DevTools Network tab to verify polling behavior and API calls. The React Developer Tools extension helps debug component state and re-renders.

## Deployment Verification

After implementing, create a pull request with your changes. Once merged to main, the GitHub Actions workflow will automatically deploy to GitHub Pages. You can monitor the deployment at `https://github.com/A5-CC/auto_pricing_ui/actions`.

The deployed site will be available at `https://a5-cc.github.io/auto_pricing_ui/runs`. Note that the production API URL is different from local development, but this is handled automatically by the environment variables.

## Common Pitfalls to Avoid

Don't use server-side features like `getServerSideProps` or API routes that require a Node.js server. Everything must work with `next export` for static deployment to GitHub Pages.

Remember to handle loading states for all async operations. Users should see skeletons or spinners while data loads, not empty screens.

Timestamps from the backend are in UTC. Convert them to the user's local timezone and consider showing relative times like "2 minutes ago" for better UX. You can use JavaScript's `Intl.DateTimeFormat` or a library like `date-fns`.

Don't forget to disable the "Run now" button while a job is active. Check the latest status and set the button's disabled prop accordingly.

## Questions or Issues?

If you encounter problems with the backend endpoints, check their implementation status in the AUTO_ANALYST repository under `api/routes/`. The endpoints are defined in Issue #3 of that repository.

For S3-related questions, refer to the schema documentation and AWS CLI commands mentioned earlier. The S3 structure is crucial for understanding what the pipeline processes.

If you need clarification on the UI requirements, the Issue #1 description in this repository has all the acceptance criteria. Follow those requirements precisely.

## Final Notes

This implementation is part of a larger system for competitive pricing analysis. The /runs page you're building is the monitoring dashboard that gives users visibility into the automated pipeline. Later, another developer will build the /pricing page (Issue #2) that displays the actual pricing data.

Focus on making the status page informative and responsive. Users should immediately understand if the pipeline is healthy, when it last ran, and whether there were any failures. The ability to manually trigger runs is important for testing and on-demand updates.

Good luck with the implementation! The existing codebase patterns are solid, so follow them consistently and you'll create a maintainable, well-integrated feature.