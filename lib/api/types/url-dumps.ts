/**
 * URL dumps data types for A0 URL discovery
 * Used by URL dumps explorer
 */

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
