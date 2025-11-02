/**
 * Raw scrapes data types for A1 scraping pipeline
 * Used by raw scrapes explorer
 */

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
