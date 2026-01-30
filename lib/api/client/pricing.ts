import {
  PricingSchemas,
  SchemaStats,
  PricingSnapshot,
  PricingDataResponse,
  FacilityPricingData,
  ColumnStatistics
} from '@/lib/api/types'
import { API_BASE_URL, fetchWithError } from './shared'
import type { Adjuster } from '@/lib/adjusters'

export async function getPricingSchemas(): Promise<PricingSchemas> {
  const response = await fetchWithError(`${API_BASE_URL}/competitors/pricing-schemas`)
  return response.json<PricingSchemas>()
}

export async function getSchemaStats(): Promise<SchemaStats> {
  const response = await fetchWithError(`${API_BASE_URL}/competitors/pricing-schemas/columns/stats`)
  return response.json<SchemaStats>()
}

export async function getPricingSnapshots(): Promise<PricingSnapshot[]> {
  const response = await fetchWithError(`${API_BASE_URL}/competitors/pricing-data/snapshots`)
  return response.json<PricingSnapshot[]>()
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
  return response.json<PricingDataResponse>()
}

export async function getFacilityPricing(
  snapshot: string,
  location: string,
  competitor?: string
): Promise<FacilityPricingData> {
  const queryParams = competitor ? `?competitor_name=${encodeURIComponent(competitor)}` : ''
  const url = `${API_BASE_URL}/competitors/pricing-data/${encodeURIComponent(snapshot)}/facility/${encodeURIComponent(location)}${queryParams}`
  const response = await fetchWithError(url)
  return response.json<FacilityPricingData>()
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
  return response.json<ColumnStatistics[]>()
}

export async function processClientCSV(
  file: File,
  snapshotId: string,
  filters: Record<string, string[]>,
  adjusters?: Adjuster[],
  combinatoric?: Record<string, boolean>
): Promise<void> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("snapshot_id", snapshotId)
  formData.append("filters", JSON.stringify(filters))
  if (adjusters) {
    formData.append("adjusters", JSON.stringify(adjusters))
  }
  if (combinatoric) {
    formData.append("combinatoric", JSON.stringify(combinatoric))
  }

  const response = await fetch(`${API_BASE_URL}/client-data/process-csv`, {
    method: "POST",
    body: formData,
  })

  if (!response.ok) {
    let errorMessage = "Failed to process CSV"
    try {
      const errorData = await response.json()
      errorMessage = errorData.detail || errorMessage
    } catch {
      errorMessage = await response.text() || errorMessage
    }
    throw new Error(errorMessage)
  }

  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `processed_${file.name}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}
