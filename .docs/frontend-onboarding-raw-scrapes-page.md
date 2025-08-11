# Frontend Implementation Guide: Raw Scrapes Explorer (/raw-scrapes)

## Project Context

You're implementing Issue #4 for the `auto_pricing_ui` project - a page to explore and view the raw scraped markdown content from competitor pricing pages. These are the outputs of the A1 (scraping) stage that runs daily after URL discovery, using Firecrawl to extract structured markdown from competitor websites.

The raw scrapes are critical for understanding what data we're working with before it gets normalized into structured tables. This explorer helps debug scraping issues, verify data quality, and understand why certain pricing information might be missing from the final processed data.

## Understanding Raw Scrapes

Raw scrapes are markdown files organized by date in S3 at `auto.pricing/competitors-raw/`. Each day's scraping run creates a folder (YYYY-MM-DD) containing:
- Multiple `.md` files, one per competitor URL scraped
- A `_run.json` file with statistics about the scraping run

Each markdown file has a specific structure:
1. **Frontmatter** (YAML between `---` markers) containing metadata
2. **Content** - The actual scraped pricing page in markdown format

The filename follows a pattern derived from the URL, making it easy to identify which competitor each file represents. For example, `extra-space-storage-austin-tx-78701.md` clearly indicates an Extra Space Storage location in Austin.

## Current Frontend Structure

Before starting, familiarize yourself with the existing codebase patterns:

The API client (`lib/api/client.ts`) uses the `fetchWithError` helper for all API calls. This pattern handles errors consistently and preserves HTTP status codes through the `ApiError` class. All your new API functions should follow this established pattern.

The UI components in `components/ui/` provide building blocks. You'll likely use `button.tsx` for actions, and may want to explore if there's a suitable component for displaying markdown content or if you need to add one.

Environment configuration (`NEXT_PUBLIC_API_URL`) automatically switches between local development (`http://localhost:8000`) and production (`https://18.189.253.176.sslip.io`).

## Backend Endpoints Ready for Use

The backend team has implemented comprehensive endpoints in `/Users/alber/Repos/AUTO_ANALYST/api/routes/competitors/raw_scrapes.py`:

**GET /competitors/raw-scrapes** (lines 70-121)
Lists all date folders with summaries. Returns scrape counts, total sizes, and run statistics for each date. Sorted newest first.

**GET /competitors/raw-scrapes/{date}** (lines 124-168)
Lists all scraped files for a specific date. Returns filename, URL slug, size, and creation time for each file. Excludes metadata files.

**GET /competitors/raw-scrapes/{date}/{filename}** (lines 171-247)
Gets the full content of a specific scrape. Parses frontmatter to extract metadata and returns both the full content and a preview.

**GET /competitors/raw-scrapes/{date}/_run** (lines 250-270)
Gets run statistics for a date's scraping session. Includes success/failure counts and details about failed URLs.

## Your Task: Build the Raw Scrapes Explorer

Create a comprehensive interface for browsing and analyzing raw scraped content. This tool should help users understand what data was captured and identify any scraping issues.

## API Integration

First, add the TypeScript types and API functions to support the raw scrapes explorer. In `lib/api/types.ts`, add:

```typescript
export interface RawScrapeSummary {
  date: string                // YYYY-MM-DD format
  filename: string            // e.g., "extra-space-storage-austin.md"
  url_slug: string           // Extracted from filename, without .md
  file_key: string           // Full S3 key path
  size_bytes: number         // File size
  created_at: string         // ISO timestamp
}

export interface RawScrapeMetadata {
  original_url?: string      // URL that was scraped
  fetched_at?: string       // When it was fetched
  run_id?: string           // Which run created this
}

export interface RawScrapeDetail {
  date: string
  filename: string
  url_slug: string
  file_key: string
  size_bytes: number
  created_at: string
  metadata: RawScrapeMetadata     // Parsed from frontmatter
  content: string                  // Full markdown content
  content_preview: string          // First 500 chars
}

export interface RawScrapeRunSummary {
  run_id: string
  started_at: string
  completed_at: string
  total_urls: number
  successful: number
  failed: number
  failed_urls: Array<{[key: string]: any}>
}

export interface RawScrapeDateSummary {
  date: string
  scrape_count: number            // Number of .md files
  total_size_bytes: number        // Combined size
  run_summary?: RawScrapeRunSummary
  latest_created_at?: string      // Most recent file timestamp
}
```

Then in `lib/api/client.ts`, implement the API functions:

```typescript
export async function getRawScrapeDates(limit = 30): Promise<RawScrapeDateSummary[]> {
  const response = await fetchWithError(
    `${API_BASE_URL}/competitors/raw-scrapes?limit=${limit}`
  )
  return response.json()
}

export async function getRawScrapesForDate(date: string): Promise<RawScrapeSummary[]> {
  const response = await fetchWithError(
    `${API_BASE_URL}/competitors/raw-scrapes/${date}`
  )
  return response.json()
}

export async function getRawScrapeDetail(
  date: string,
  filename: string
): Promise<RawScrapeDetail> {
  const response = await fetchWithError(
    `${API_BASE_URL}/competitors/raw-scrapes/${date}/${filename}`
  )
  return response.json()
}

export async function getRawScrapeRunSummary(
  date: string
): Promise<RawScrapeRunSummary | null> {
  const response = await fetchWithError(
    `${API_BASE_URL}/competitors/raw-scrapes/${date}/_run`
  )
  return response.json()
}
```

## Page Implementation

Create the main page at `app/raw-scrapes/page.tsx` with a two-level navigation structure:

```typescript
'use client'

import { useState, useEffect } from 'react'
import {
  getRawScrapeDates,
  getRawScrapesForDate,
  getRawScrapeDetail
} from '@/lib/api/client'
import type {
  RawScrapeDateSummary,
  RawScrapeSummary,
  RawScrapeDetail
} from '@/lib/api/types'

export default function RawScrapesPage() {
  const [dates, setDates] = useState<RawScrapeDateSummary[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [scrapes, setScrapes] = useState<RawScrapeSummary[]>([])
  const [selectedScrape, setSelectedScrape] = useState<RawScrapeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDates()
  }, [])

  const loadDates = async () => {
    try {
      setLoading(true)
      const datesList = await getRawScrapeDates()
      setDates(datesList)
    } catch (err) {
      setError('Failed to load scrape dates')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectDate = async (date: string) => {
    try {
      setSelectedDate(date)
      const scrapesList = await getRawScrapesForDate(date)
      setScrapes(scrapesList)
      setSelectedScrape(null) // Clear any selected scrape
    } catch (err) {
      console.error('Failed to load scrapes:', err)
    }
  }

  const handleViewScrape = async (date: string, filename: string) => {
    try {
      const detail = await getRawScrapeDetail(date, filename)
      setSelectedScrape(detail)
    } catch (err) {
      console.error('Failed to load scrape detail:', err)
    }
  }

  // Render based on current navigation level
  if (selectedScrape) {
    return <ScrapeViewer scrape={selectedScrape} onBack={() => setSelectedScrape(null)} />
  }

  if (selectedDate) {
    return (
      <ScrapesList
        date={selectedDate}
        scrapes={scrapes}
        onBack={() => setSelectedDate(null)}
        onView={handleViewScrape}
      />
    )
  }

  return <DateFoldersList dates={dates} onSelect={handleSelectDate} loading={loading} />
}
```

## Component Structure

Organize components for clarity and reusability under `components/raw-scrapes/`:

**date-folders-table.tsx** - Main list of date folders
```typescript
export function DateFoldersTable({ dates, onSelect }) {
  const calculateSuccessRate = (summary?: RawScrapeRunSummary) => {
    if (!summary) return null
    return Math.round((summary.successful / summary.total_urls) * 100)
  }

  return (
    <table>
      {/* Headers: Date | Scrapes | Size | Success Rate | Actions */}
      {dates.map(date => (
        <tr key={date.date}>
          <td>{date.date}</td>
          <td>{date.scrape_count} files</td>
          <td>{formatBytes(date.total_size_bytes)}</td>
          <td>
            {date.run_summary && (
              <SuccessRateBadge rate={calculateSuccessRate(date.run_summary)} />
            )}
          </td>
          <td>
            <Button onClick={() => onSelect(date.date)}>Browse</Button>
          </td>
        </tr>
      ))}
    </table>
  )
}
```

**scrapes-list.tsx** - List of scrapes for a selected date
```typescript
export function ScrapesList({ date, scrapes, onBack, onView }) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredScrapes = scrapes.filter(s =>
    s.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.url_slug.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div>
      <Button onClick={onBack}>← Back to dates</Button>
      <h2>Scrapes for {date}</h2>
      <input
        placeholder="Search by filename or URL..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <table>
        {filteredScrapes.map(scrape => (
          <tr key={scrape.filename}>
            <td>{scrape.filename}</td>
            <td>{formatBytes(scrape.size_bytes)}</td>
            <td>{new Date(scrape.created_at).toLocaleString()}</td>
            <td>
              <Button onClick={() => onView(date, scrape.filename)}>View</Button>
            </td>
          </tr>
        ))}
      </table>
    </div>
  )
}
```

**scrape-viewer.tsx** - Full content viewer with markdown rendering
```typescript
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'

export function ScrapeViewer({ scrape, onBack }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(scrape.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-4">
        <Button onClick={onBack}>← Back to list</Button>
        <Button onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy content'}
        </Button>
      </div>

      {/* Metadata section */}
      <div className="bg-gray-50 p-4 rounded mb-6">
        <h3 className="font-semibold mb-2">Metadata</h3>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt>Original URL:</dt>
          <dd>
            {scrape.metadata.original_url ? (
              <a href={scrape.metadata.original_url} target="_blank" rel="noopener">
                {scrape.metadata.original_url}
              </a>
            ) : 'N/A'}
          </dd>
          <dt>Fetched at:</dt>
          <dd>{scrape.metadata.fetched_at || 'N/A'}</dd>
          <dt>Run ID:</dt>
          <dd className="font-mono text-xs">{scrape.metadata.run_id || 'N/A'}</dd>
        </dl>
      </div>

      {/* Markdown content */}
      <div className="prose max-w-none">
        <ReactMarkdown
          components={{
            code({ node, inline, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '')
              return !inline && match ? (
                <SyntaxHighlighter language={match[1]} {...props}>
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code className={className} {...props}>
                  {children}
                </code>
              )
            }
          }}
        >
          {scrape.content}
        </ReactMarkdown>
      </div>
    </div>
  )
}
```

**success-rate-badge.tsx** - Visual indicator for scraping success
```typescript
export function SuccessRateBadge({ rate }: { rate: number | null }) {
  if (rate === null) return null

  const color = rate >= 90 ? 'bg-green-500' : rate >= 70 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-white text-xs ${color}`}>
      {rate}% success
    </span>
  )
}
```

## Markdown Rendering Setup

Install the required packages for markdown rendering:

```bash
npm install react-markdown react-syntax-highlighter
npm install -D @types/react-syntax-highlighter
```

Configure the markdown renderer to handle:
- **Tables**: Pricing tables are common in scraped content
- **Code blocks**: Some pages include JSON or structured data
- **Links**: Preserve links but open in new tabs
- **Lists**: Unit features often presented as lists

## Navigation and State Management

Implement a three-level navigation hierarchy:
1. **Date list** → Shows all available dates
2. **Scrapes list** → Shows scrapes for selected date
3. **Content viewer** → Shows full content of selected scrape

Use URL state to enable deep linking:
```typescript
// In your page component
const searchParams = useSearchParams()
const router = useRouter()

// Read state from URL
const dateParam = searchParams.get('date')
const fileParam = searchParams.get('file')

// Update URL when navigating
const handleSelectDate = (date: string) => {
  router.push(`/raw-scrapes?date=${date}`)
}
```

## Performance Optimization

Raw markdown files can be large, so optimize loading:

1. **Lazy Loading**: Only load full content when viewing, not in list
2. **Caching**: Cache viewed content in component state
3. **Virtualization**: For long lists of scrapes, consider react-window
4. **Progressive Loading**: Show preview first, then full content

```typescript
const [contentCache, setContentCache] = useState<Map<string, RawScrapeDetail>>(new Map())

const loadScrapeDetail = async (date: string, filename: string) => {
  const cacheKey = `${date}/${filename}`

  // Check cache first
  if (contentCache.has(cacheKey)) {
    return contentCache.get(cacheKey)
  }

  // Load and cache
  const detail = await getRawScrapeDetail(date, filename)
  setContentCache(prev => new Map(prev).set(cacheKey, detail))
  return detail
}
```

## Error Handling and Edge Cases

Handle various scenarios gracefully:

1. **No scrapes for date**: Show informative message
2. **Failed scrapes**: Highlight in run summary
3. **Large files**: Show loading state, consider pagination
4. **Network errors**: Retry mechanism with exponential backoff
5. **Invalid markdown**: Fallback to plain text display

## Styling Considerations

The scraped content varies widely, so provide flexible styling:

```css
/* Custom styles for scraped content */
.prose table {
  @apply w-full border-collapse;
}

.prose th {
  @apply bg-gray-100 p-2 text-left font-semibold;
}

.prose td {
  @apply border p-2;
}

/* Highlight pricing information */
.prose strong:has-text("$") {
  @apply text-green-600 font-bold;
}
```

## Testing Your Implementation

Test these critical scenarios:

1. **Date Navigation**:
   - List loads and sorts correctly
   - Success rates calculate properly
   - Failed scrapes indicated clearly

2. **Scrapes List**:
   - All scrapes for date displayed
   - Search/filter works correctly
   - File sizes formatted properly

3. **Content Viewer**:
   - Markdown renders correctly
   - Tables display properly
   - Metadata extracted from frontmatter
   - Copy functionality works
   - Links open in new tabs

4. **Performance**:
   - Large markdown files load acceptably
   - Navigation remains responsive
   - Memory usage stays reasonable

5. **Error States**:
   - Network failures handled gracefully
   - Empty states show appropriate messages
   - Invalid data doesn't crash the app

## Debugging Tips

Use these approaches to debug issues:

```typescript
// Log API responses for inspection
const response = await getRawScrapesForDate(date)
console.log('Scrapes response:', response)

// Check markdown parsing
console.log('Parsed frontmatter:', scrape.metadata)
console.log('Content length:', scrape.content.length)

// Monitor performance
console.time('Load scrape detail')
const detail = await getRawScrapeDetail(date, filename)
console.timeEnd('Load scrape detail')
```

## Common Pitfalls to Avoid

1. **Frontmatter Parsing**: Not all files have frontmatter - handle gracefully
2. **Large Content**: Don't load all content at once - paginate or virtualize
3. **URL Encoding**: Filenames might need encoding for API calls
4. **Memory Leaks**: Clear cache when navigating away
5. **Timezone Issues**: Display times in user's local timezone

## Future Enhancements

Consider these improvements after the initial implementation:

1. **Diff View**: Compare same competitor across dates
2. **Export**: Download selected scrapes as ZIP
3. **Analytics**: Graph success rates over time
4. **Search**: Full-text search across all content
5. **Annotations**: Allow users to mark scraping issues

## Final Notes

The Raw Scrapes Explorer is a critical debugging tool for the pricing pipeline. It provides visibility into the raw data that feeds the normalization process, helping identify scraping issues before they affect downstream analytics.

Focus on making the content easily browsable and searchable. Users need to quickly verify that competitor pricing data is being captured correctly and identify patterns in scraping failures.

The markdown rendering is particularly important - pricing pages often contain complex tables and structured data that must display correctly for users to validate the scraping quality.

Good luck with the implementation! The backend is fully ready, and the existing codebase patterns provide a solid foundation for this new feature.