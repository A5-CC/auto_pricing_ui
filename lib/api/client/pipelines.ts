import { E1Snapshot, E1DataResponse, ColumnStatistics } from '@/lib/api/types'
import { API_BASE_URL, fetchWithError } from './shared'

export async function getE1Snapshots(): Promise<E1Snapshot[]> {
  const response = await fetchWithError(`${API_BASE_URL}/competitors/e1-data/snapshots`)
  return response.json()
}

export async function getE1Data(
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
): Promise<E1DataResponse> {
  const queryParams = new URLSearchParams()
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) queryParams.append(key, String(value))
    })
  }
  const url = `${API_BASE_URL}/competitors/e1-data/${encodeURIComponent(snapshot)}${queryParams.toString() ? `?${queryParams}` : ""}`
  const response = await fetchWithError(url)
  return response.json()
}

export async function exportE1CSV(
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
  const url = `${API_BASE_URL}/competitors/e1-data/${encodeURIComponent(snapshot)}/export/csv${queryParams.toString() ? `?${queryParams}` : ''}`
  const response = await fetchWithError(url)
  return response.blob()
}

export async function getE1ColumnStatistics(
  snapshot: string,
  columns?: string[]
): Promise<ColumnStatistics[]> {
  const queryParams = columns && columns.length ? `?columns=${columns.join(',')}` : ''
  const url = `${API_BASE_URL}/competitors/e1-data/${encodeURIComponent(snapshot)}/statistics${queryParams}`
  const response = await fetchWithError(url)
  return response.json()
}
