import {
  PricingSchemas,
  SchemaStats,
  PricingSnapshot,
  PricingDataResponse,
  FacilityPricingData,
  ColumnStatistics
} from '@/lib/api/types'
import { API_BASE_URL, fetchWithError } from './shared'

export async function getPricingSchemas(): Promise<PricingSchemas> {
  const response = await fetchWithError(`${API_BASE_URL}/competitors/pricing-schemas`)
  return response.json()
}

export async function getSchemaStats(): Promise<SchemaStats> {
  const response = await fetchWithError(`${API_BASE_URL}/competitors/pricing-schemas/columns/stats`)
  return response.json()
}

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
  const url = `${API_BASE_URL}/competitors/pricing-data/${encodeURIComponent(snapshot)}${queryParams.toString() ? `?${queryParams}` : ""}`
  const response = await fetchWithError(url)
  return response.json()
}

export async function getFacilityPricing(
  snapshot: string,
  location: string,
  competitor?: string
): Promise<FacilityPricingData> {
  const queryParams = competitor ? `?competitor_name=${encodeURIComponent(competitor)}` : ''
  const url = `${API_BASE_URL}/competitors/pricing-data/${encodeURIComponent(snapshot)}/facility/${encodeURIComponent(location)}${queryParams}`
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
  const url = `${API_BASE_URL}/competitors/pricing-data/${encodeURIComponent(snapshot)}/export/csv${queryParams.toString() ? `?${queryParams}` : ''}`
  const response = await fetchWithError(url)
  return response.blob()
}

export async function getColumnStatistics(
  snapshot: string,
  columns?: string[]
): Promise<ColumnStatistics[]> {
  const queryParams = columns && columns.length ? `?columns=${columns.join(',')}` : ''
  const url = `${API_BASE_URL}/competitors/pricing-data/${encodeURIComponent(snapshot)}/statistics${queryParams}`
  const response = await fetchWithError(url)
  return response.json()
}
