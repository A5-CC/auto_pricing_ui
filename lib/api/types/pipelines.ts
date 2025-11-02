/**
 * Pipelines (E1 + E2) data types for /pipelines page
 *
 * DEPENDENCIES - BLOCKING ON ALEX'S E1:
 * - E1 norm-E1 dataset (A2 competitors + ModStorage client data merged & normalized v2)
 * - E1 filtering endpoint (server-side categorical filters)
 * - E1 snapshot listing endpoint
 *
 * ASSUMPTIONS (TBC with Alex):
 * - Same spine as A2: snapshot_date, modstorage_location, competitor_name, competitor_address
 * - Additional ModStorage columns (e.g., client_current_price, client_unit_availability, etc.)
 * - Data format: Parquet (similar to A2 output)
 * - S3 location: TBD (likely processed-e1/{run_id}.parquet or similar)
 */

/**
 * E1 Snapshot metadata
 * Similar to PricingSnapshot but for norm-E1 data
 */
export interface E1Snapshot {
  date: string
  rows: number
  facilities: number
  file_size: number
  last_modified: string
  columns: number
  // Additional fields TBD
}

/**
 * E1 Data Row
 * Extends A2 data with ModStorage client fields
 *
 * SPINE (assumed same as A2):
 * - snapshot_date
 * - modstorage_location
 * - competitor_name
 * - competitor_address
 *
 * CANONICAL (dynamic, from A2):
 * - unit_dimensions, unit_code, unit_category
 * - monthly_rate_starting, monthly_rate_instore, admin_fee
 * - promotional_offer, availability_status
 * - etc. (all competitor pricing fields)
 *
 * MODSTORAGE (TBD - need Alex input):
 * - client_current_price?
 * - client_unit_availability?
 * - client_unit_type?
 * - etc.
 */
export interface E1DataRow {
  // Spine (required)
  snapshot_date: string
  modstorage_location: string
  competitor_name: string
  competitor_address: string

  // Canonical (optional, from A2)
  unit_dimensions?: string
  unit_code?: string
  unit_category?: string
  monthly_rate_starting?: number
  monthly_rate_instore?: number
  admin_fee?: number
  promotional_offer?: string
  availability_status?: string

  // ModStorage fields (TBD - examples)
  client_current_price?: number
  client_unit_availability?: string
  client_unit_type?: string

  // Dynamic columns
  [key: string]: unknown
}

/**
 * E1 Data Response
 * Similar to PricingDataResponse but for norm-E1 data
 */
export interface E1DataResponse {
  snapshot_date: string
  total_rows: number
  total_facilities: number
  columns: string[]
  data: E1DataRow[]
  filters_applied: Record<string, unknown>
}

/**
 * E1 Filter Request
 * Server-side categorical filtering
 *
 * CONTRACT TBD WITH ALEX - this is speculative
 * Likely similar to A2 filters but server-side instead of client-side
 */
export interface E1FilterRequest {
  snapshot: string
  filters?: {
    competitors?: string[]
    locations?: string[]
    dimensions?: string[]
    unit_categories?: string[]
    // Additional ModStorage filters TBD
  }
  limit?: number
  offset?: number
}

/**
 * E1 Filter Response
 * Result of server-side filtering
 *
 * CONTRACT TBD WITH ALEX
 */
export interface E1FilterResponse {
  snapshot_date: string
  total_rows: number
  total_facilities: number
  columns: string[]
  data: E1DataRow[]
  filters_applied: Record<string, unknown>
}

/**
 * E2 Price Adjuster Configuration (FUTURE)
 * Not blocking initial /pipelines page development
 *
 * Three adjuster types planned:
 * 1. Competitive Price Adjuster: multiplier * agg_function(competitor_prices)
 * 2. Temporal Discrete Adjuster: day/month multipliers
 * 3. Function-Based Adjuster: custom mathematical expressions
 */
export interface PriceAdjusterConfig {
  // TBD - E2 implementation details
  type: 'competitive' | 'temporal' | 'function'
  enabled: boolean
  // Type-specific config...
}

/**
 * Pipeline Configuration (FUTURE)
 * Saves user-defined pricing strategies
 *
 * Not blocking initial development
 */
export interface PipelineConfig {
  id: string
  name: string
  snapshot: string
  filters: E1FilterRequest['filters']
  adjusters: PriceAdjusterConfig[]
  created_at: string
  updated_at: string
}
