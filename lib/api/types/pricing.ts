/**
 * Pricing data types for A2 normalized competitor pricing
 * Used by /pricing page
 */

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

// Pricing data
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
