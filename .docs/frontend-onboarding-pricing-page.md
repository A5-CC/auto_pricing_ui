# Frontend Implementation Guide: Competitive Pricing Dashboard (/pricing)

## Project Context

You're working on `auto_pricing_ui`, a Next.js frontend for a competitor pricing analysis system. This guide will help you implement the pricing dashboard that displays the processed competitor pricing data. The backend has already been enhanced with comprehensive pricing data endpoints that provide access to the normalized Parquet files containing all competitor storage unit pricing.

The frontend is configured with Next.js 15, Tailwind CSS, and shadcn/ui components. It deploys automatically to GitHub Pages at `https://a5-cc.github.io/auto_pricing_ui/` on push to main. The project uses TypeScript with strict mode and follows the App Router pattern.

## Understanding the Data Model

Before building the UI, it's crucial to understand the multi-row per facility data model. Each storage facility has multiple rows in the dataset - one for each unique unit offering. For example, a single Extra Space Storage location might have 10 rows representing different unit sizes (5x5, 10x10, etc.) with varying features (climate control, drive-up access).

The data has two schema components:
1. **Spine columns** (primary keys): `snapshot_date`, `modstorage_location`, `competitor_name`, `competitor_address`
2. **Data columns**: `unit_dimensions`, `monthly_rate_starting`, `monthly_rate_instore`, and dozens of feature flags

The schema is evolutionary and can have 30-50+ columns. The backend automatically filters sparse columns (< 25% fill rate) by default to keep the UI clean. You can override this with `include_sparse_columns=true` if needed.

## Backend API Endpoints Available

The backend provides these endpoints under `/competitors/pricing-data/`:

### 1. Get Available Snapshots
```typescript
GET /competitors/pricing-data/snapshots
Returns: Array of snapshot metadata with dates, row counts, and file sizes
```

### 2. Get Pricing Data
```typescript
GET /competitors/pricing-data/{snapshot_date}
Query params:
  - modstorage_location: Filter by our location
  - competitor_name: Filter by competitor
  - unit_dimensions: Filter by unit size (e.g., "10x10")
  - limit: Max rows (default 100, max 1000)
  - offset: Pagination offset
  - min_fill_rate: Column fill threshold (default 0.25)
  - include_sparse_columns: Override column filtering

Returns: Filtered pricing data with pagination
```

### 3. Get Facility Pricing
```typescript
GET /competitors/pricing-data/{snapshot_date}/facility/{modstorage_location}
Query params:
  - competitor_name: Optional competitor filter

Returns: All unit offerings for a specific facility
```

### 4. Export as CSV
```typescript
GET /competitors/pricing-data/{snapshot_date}/export/csv
Query params:
  - modstorage_location: Optional location filter
  - competitor_name: Optional competitor filter
  - columns: Comma-separated column list

Returns: CSV file download
```

### 5. Get Column Statistics
```typescript
GET /competitors/pricing-data/{snapshot_date}/statistics
Query params:
  - columns: Optional columns to analyze

Returns: Statistics showing data quality and fill rates
```

### 6. Get Schemas
```typescript
GET /competitors/pricing-schemas
Returns: Both spine and canonical schemas

GET /competitors/pricing-schemas/spine
Returns: Immutable primary key columns

GET /competitors/pricing-schemas/canonical
Returns: All discovered data columns with metadata
```

## Your Task: Build the Pricing Dashboard

Create a comprehensive pricing dashboard at `/pricing` that allows users to explore and analyze competitor pricing data. The page should provide multiple views and filtering capabilities.

## API Client Implementation

Add these TypeScript interfaces to `lib/api/types.ts`:

```typescript
export interface PricingSnapshot {
  date: string
  rows: number
  facilities: number
  file_size: number
  last_modified: string
  columns: number
}

export interface PricingDataResponse {
  snapshot_date: string
  total_rows: number
  total_facilities: number
  columns: string[]
  data: PricingDataRow[]
  filters_applied: Record<string, any>
}

export interface PricingDataRow {
  modstorage_location: string
  competitor_name: string
  competitor_address: string
  snapshot_date: string
  unit_dimensions?: string
  unit_code?: string
  unit_category?: string
  monthly_rate_starting?: number
  monthly_rate_instore?: number
  admin_fee?: number
  promotional_offer?: string
  availability_status?: string
  [key: string]: any // For dynamic columns
}

export interface FacilityPricingData {
  modstorage_location: string
  competitor_name: string
  competitor_address: string
  snapshot_date: string
  units: PricingDataRow[]
  unit_count: number
}

export interface ColumnStatistics {
  column: string
  data_type: string
  non_null_count: number
  null_count: number
  fill_rate: number
  unique_values?: number
  sample_values?: any[]
}

export interface SpineColumn {
  id: string
  label: string
  description: string
  type: string
}

export interface CanonicalColumn {
  type: string
  first_seen: string
  label?: string
  unit?: string
  description?: string
}

export interface PricingSchemas {
  spine: SpineColumn[]
  canonical?: {
    version: number
    last_updated: string
    columns: Record<string, CanonicalColumn>
    total_columns: number
  }
  spine_exists: boolean
  canonical_exists: boolean
}
```

Then implement API functions in `lib/api/client.ts`:

```typescript
export async function getPricingSnapshots(): Promise<PricingSnapshot[]> {
  const response = await fetchWithError(`${API_BASE_URL}/competitors/pricing-data/snapshots`)
  return response.json()
}

export async function getPricingData(
  snapshot: string,
  params?: {
    modstorage_location?: string
    competitor_name?: string
    unit_dimensions?: string
    limit?: number
    offset?: number
    min_fill_rate?: number
    include_sparse_columns?: boolean
  }
): Promise<PricingDataResponse> {
  const queryParams = new URLSearchParams()
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) queryParams.append(key, String(value))
    })
  }
  const url = `${API_BASE_URL}/competitors/pricing-data/${snapshot}?${queryParams}`
  const response = await fetchWithError(url)
  return response.json()
}

export async function getFacilityPricing(
  snapshot: string,
  location: string,
  competitor?: string
): Promise<FacilityPricingData> {
  const queryParams = competitor ? `?competitor_name=${encodeURIComponent(competitor)}` : ''
  const url = `${API_BASE_URL}/competitors/pricing-data/${snapshot}/facility/${encodeURIComponent(location)}${queryParams}`
  const response = await fetchWithError(url)
  return response.json()
}

export async function exportPricingCSV(
  snapshot: string,
  params?: {
    modstorage_location?: string
    competitor_name?: string
    columns?: string[]
  }
): Promise<Blob> {
  const queryParams = new URLSearchParams()
  if (params) {
    if (params.modstorage_location) queryParams.append('modstorage_location', params.modstorage_location)
    if (params.competitor_name) queryParams.append('competitor_name', params.competitor_name)
    if (params.columns) queryParams.append('columns', params.columns.join(','))
  }
  const url = `${API_BASE_URL}/competitors/pricing-data/${snapshot}/export/csv?${queryParams}`
  const response = await fetchWithError(url)
  return response.blob()
}

export async function getColumnStatistics(
  snapshot: string,
  columns?: string[]
): Promise<ColumnStatistics[]> {
  const queryParams = columns ? `?columns=${columns.join(',')}` : ''
  const url = `${API_BASE_URL}/competitors/pricing-data/${snapshot}/statistics${queryParams}`
  const response = await fetchWithError(url)
  return response.json()
}

export async function getPricingSchemas(): Promise<PricingSchemas> {
  const response = await fetchWithError(`${API_BASE_URL}/competitors/pricing-schemas`)
  return response.json()
}
```

## Component Structure

Create the main page at `app/pricing/page.tsx` as a client component that manages state for:
- Selected snapshot (default to "latest")
- Active filters (location, competitor, unit size)
- View mode (table, cards, comparison)
- Column visibility settings

### Core Components to Build

Under `components/pricing/`:

#### 1. `snapshot-selector.tsx`
Dropdown to select which snapshot to view. Show date, row count, and facility count for each option. Default to "latest" snapshot.

#### 2. `pricing-data-table.tsx`
Main data table with:
- Sortable columns
- Pagination controls
- Row highlighting
- Responsive design (stack on mobile)
- Dynamic columns based on data

Key features:
- Group rows by facility (same location + competitor)
- Show unit dimensions prominently
- Format currency values with $ symbol
- Use color coding for pricing tiers
- Handle null values gracefully (show "-" or "N/A")

#### 3. `facility-card.tsx`
Card view for a single facility showing all its unit offerings in a compact format. Include:
- Facility header with name and address
- Grid of unit cards with size and price
- Promotional offers highlighted
- Availability indicators

#### 4. `filter-panel.tsx`
Collapsible filter panel with:
- Location selector (dropdown)
- Competitor selector (multi-select)
- Unit size filter (common sizes: 5x5, 10x10, etc.)
- Price range slider
- Column visibility toggle

#### 5. `comparison-view.tsx`
Side-by-side comparison of multiple facilities:
- Select 2-4 facilities to compare
- Align by unit dimensions
- Highlight price differences
- Show feature comparisons

#### 6. `column-manager.tsx`
Advanced settings to manage visible columns:
- Show column statistics (fill rate, unique values)
- Toggle individual columns
- Save column preferences to localStorage
- Option to show/hide sparse columns

## Data Visualization Components

Add these visualization components for better insights:

#### 1. `price-distribution-chart.tsx`
Histogram showing price distribution for selected unit size across all competitors. Use a charting library like recharts or Chart.js.

#### 2. `facility-metrics.tsx`
Summary cards showing:
- Average price by unit size
- Total facilities
- Price range (min-max)
- Most common features

#### 3. `pricing-trends.tsx`
If multiple snapshots exist, show pricing trends over time. Line chart with different series for each unit size.

## Key Implementation Details

### Handling Dynamic Columns
The schema is evolutionary, so columns vary between snapshots. Use TypeScript's index signatures and dynamic rendering:

```typescript
// Render dynamic columns
{columns.map(col => (
  <td key={col}>
    {formatCellValue(row[col], getColumnType(col))}
  </td>
))}

// Format based on type
function formatCellValue(value: any, type: string) {
  if (value === null || value === undefined) return '-'
  if (type === 'decimal' && typeof value === 'number') {
    return `$${value.toFixed(2)}`
  }
  if (type === 'boolean') {
    return value ? '✓' : '✗'
  }
  return String(value)
}
```

### Pagination Strategy
With potentially 1000+ rows, implement efficient pagination:
- Server-side pagination (use limit/offset params)
- Show 50-100 rows per page
- Include page size selector
- Display total count and current range

### Performance Optimization
- Memoize expensive computations with `useMemo`
- Virtualize long lists if showing all units
- Debounce filter changes to reduce API calls
- Cache snapshot data in component state

### Mobile Responsiveness
Design for mobile-first:
- Stack filters vertically on small screens
- Use horizontal scroll for wide tables
- Provide card view as mobile-friendly alternative
- Ensure touch-friendly controls

## Advanced Features

### 1. Smart Grouping
Group units by facility automatically. Show facility header once with all its units below. Calculate facility-level metrics (average price, total units).

### 2. Quick Actions
Add action buttons for common tasks:
- Export current view to CSV
- Copy facility data to clipboard
- Share filtered view (URL with params)
- Print-friendly view

### 3. Saved Views
Allow users to save filter combinations:
- Store in localStorage
- Quick access dropdown
- Named views (e.g., "10x10 units in Austin")

### 4. Data Quality Indicators
Show data quality badges:
- Green: >90% data completeness
- Yellow: 50-90% completeness
- Red: <50% completeness
- Info tooltip explaining missing data

## Error Handling and Edge Cases

Handle these scenarios gracefully:

1. **No snapshots available**: Show empty state with explanation
2. **Empty filter results**: Suggest broadening filters
3. **Sparse data**: Explain why some columns are hidden
4. **Large datasets**: Show loading progress for big queries
5. **Network errors**: Retry button and offline indicator

## Testing Your Implementation

Test these critical flows:

1. **Initial Load**
   - Page loads with latest snapshot
   - Default columns are visible
   - Data displays correctly

2. **Filtering**
   - Each filter type works independently
   - Combined filters work correctly
   - Clear filters resets view

3. **Pagination**
   - Navigation between pages works
   - Page size changes update view
   - Total count is accurate

4. **Export**
   - CSV download works
   - Exported data matches current filters
   - File naming is appropriate

5. **Mobile Experience**
   - Touch controls work smoothly
   - Layout adapts to screen size
   - Performance is acceptable

## Integration with Existing Pages

Link from the `/runs` page:
- Add "View Pricing Data" button when pipeline completes
- Show snapshot date in success message
- Quick link to latest processed data

Add navigation in the main layout:
- Pricing menu item in header
- Badge showing latest snapshot date
- Quick stats in navigation tooltip

## Performance Benchmarks

Aim for these performance targets:
- Initial page load: < 2 seconds
- Filter application: < 500ms
- Page navigation: < 300ms
- Export generation: < 3 seconds

## Deployment Considerations

Remember the production environment differences:
- API URL changes (handled by env vars)
- CORS is configured on backend
- Static export compatible (no SSR)
- GitHub Pages base path handling

## Common Issues and Solutions

**Issue**: Too many columns make table unwieldy
**Solution**: Use column filtering and horizontal scroll with frozen first columns

**Issue**: Slow loading with large datasets
**Solution**: Implement virtual scrolling or increase pagination

**Issue**: Confusing multi-row per facility model
**Solution**: Clear visual grouping and explanatory tooltips

**Issue**: Dynamic schema causes TypeScript errors
**Solution**: Use proper index signatures and runtime type checking

## Next Steps

After implementing the basic dashboard, consider these enhancements:

1. **Advanced Analytics**
   - Price optimization suggestions
   - Competitor clustering analysis
   - Anomaly detection for outliers

2. **Alerting System**
   - Price change notifications
   - New competitor alerts
   - Data quality warnings

3. **Historical Analysis**
   - Time series comparisons
   - Trend predictions
   - Seasonal pattern detection

## Resources

- Backend API docs: Check `/docs` endpoint on backend
- S3 Schema: `/Users/alber/Repos/AUTO_ANALYST/.docs/data-layer/schema/s3-bucket.yaml`
- Design decisions: `/Users/alber/Repos/AUTO_ANALYST/.docs/architecture/decisions/002-evolutionary-schema-pattern.md`
- Data model: `/Users/alber/Repos/AUTO_ANALYST/.docs/a2-pricing-extraction-design.md`

## Support

If you encounter issues:
1. Check the backend logs for API errors
2. Verify data exists in S3 for the selected snapshot
3. Use browser DevTools to debug network requests
4. Test with `include_sparse_columns=true` if data seems missing

The pricing dashboard is the culmination of the entire pipeline - from URL discovery through scraping to normalization. Make it powerful yet intuitive, allowing users to gain competitive insights quickly and efficiently.