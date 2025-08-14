// API Types

//FIXME: This is from auto analyst fork; remove the type and all references to it
export interface UploadResponse {
  job_id: string
}

//FIXME: This is from auto analyst fork; remove the type and all references to it
export interface JobStatus {
  job_id: string
  doc_id?: string
  filename?: string
  status: 'processing' | 'done' | 'error'
  summary_url?: string
  error?: string
  error_message?: string
}

//FIXME: This is from auto analyst fork; remove the type and all references to it
export interface DocMeta {
  id: string
  title: string
  created_at: string
  status?: 'processing' | 'done' | 'error'
  job_id?: string
}

export type AppMode = 'idle' | 'uploading' | 'processing' | 'done' | 'error' | 'timeout'

// Runs page types
export interface RunStatus {
  run_id: string
  status: 'idle' | 'running' | 'completed' | 'failed'
  started_at?: string
  finished_at?: string
  rows_processed?: number
  duration_s?: number
  failed_count?: number
}

export interface RunResponse {
  run_id: string
  queued: boolean
}

// URL Dumps explorer types
export interface URLDumpSummary {
  timestamp: string
  file_key: string
  total_urls: number
  valid_urls: number
  created_at: string
  size_bytes: number
}

export interface URLDumpEntry {
  modstorage_location: string
  competitor_name: string
  competitor_address: string
  maps_url: string
  final_pricing_url: string
  confidence: number
  timestamp: string
}

export interface URLDumpDetail {
  timestamp: string
  file_key: string
  total_urls: number
  valid_urls: number
  created_at: string
  urls: URLDumpEntry[]
  locations_summary: Record<string, number>
  competitors_summary: Record<string, number>
}

// Raw Scrapes explorer types
export interface RawScrapeSummary {
  date: string
  filename: string
  url_slug: string
  file_key: string
  size_bytes: number
  created_at: string
}

export interface RawScrapeMetadata {
  original_url?: string
  fetched_at?: string
  run_id?: string
}

export interface RawScrapeDetail {
  date: string
  filename: string
  url_slug: string
  file_key: string
  size_bytes: number
  created_at: string
  metadata: RawScrapeMetadata
  content: string
  content_preview: string
}

export interface UrlResult {
  competitor_name: string
  modstorage_location: string
  final_pricing_url: string
  status: string
  chars_scraped?: number
  has_pricing?: boolean
  readiness_reason?: string
  readiness_confidence?: number
  readiness_category?: string
  error?: string
}

export interface RawScrapeRunSummary {
  run_id: string
  started_at: string
  completed_at: string
  total_urls: number
  successful: number
  failed: number
  failed_urls: Array<Record<string, unknown>>
  url_results?: UrlResult[]
  pricing_viable_urls?: number
  non_pricing_urls?: number
}

export interface RawScrapeDateSummary {
  date: string
  scrape_count: number
  total_size_bytes: number
  run_summary?: RawScrapeRunSummary
  latest_created_at?: string
}

// Pricing Schemas
export interface SpineColumn {
  id: string
  label: string
  description: string
  type: "string" | "decimal" | "boolean" | "integer"
}

export interface CanonicalColumn {
  type: "string" | "decimal" | "boolean" | "integer"
  first_seen: string
  label?: string
  unit?: string
  description?: string
}

export interface CanonicalWideSchema {
  version: number
  last_updated: string
  columns: Record<string, CanonicalColumn>
  total_columns: number
}

export interface PricingSchemas {
  spine: SpineColumn[]
  canonical?: CanonicalWideSchema
  spine_exists: boolean
  canonical_exists: boolean
}

export interface SchemaStats {
  spine_columns: number
  canonical_columns: number
  total_columns: number
  column_types: Record<string, number>
  latest_columns: Array<{ name: string; first_seen: string }>
  schema_version: number
  last_updated?: string
}

// Pricing data types
export interface PricingSnapshot {
  date: string
  rows: number
  facilities: number
  file_size: number
  last_modified: string
  columns: number
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
  [key: string]: unknown
}

export interface PricingDataResponse {
  snapshot_date: string
  total_rows: number
  total_facilities: number
  columns: string[]
  data: PricingDataRow[]
  filters_applied: Record<string, unknown>
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
  sample_values?: unknown[]
}