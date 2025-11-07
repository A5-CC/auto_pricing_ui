import { E1Snapshot, E1DataResponse, ColumnStatistics, Pipeline, CreatePipelineRequest, UpdatePipelineRequest } from '@/lib/api/types'
import { API_BASE_URL, fetchWithError } from './shared'

/**
 * E1 Competitors API (EXCLUDES modSTORAGE client data)
 *
 * These endpoints return only competitor pricing data for benchmarking.
 * modSTORAGE client data is automatically excluded by the backend.
 */

export async function getE1Snapshots(): Promise<E1Snapshot[]> {
  const response = await fetchWithError(`${API_BASE_URL}/competitors/e1-data/snapshots`)
  return response.json()
}

export async function getE1Competitors(
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
  const url = `${API_BASE_URL}/competitors/e1-data/${encodeURIComponent(snapshot)}/competitors${queryParams.toString() ? `?${queryParams}` : ""}`
  const response = await fetchWithError(url)
  return response.json()
}

export async function exportE1CompetitorsCSV(
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
  const url = `${API_BASE_URL}/competitors/e1-data/${encodeURIComponent(snapshot)}/competitors/export/csv${queryParams.toString() ? `?${queryParams}` : ''}`
  const response = await fetchWithError(url)
  return response.blob()
}

export async function getE1CompetitorsStatistics(
  snapshot: string,
  columns?: string[]
): Promise<ColumnStatistics[]> {
  const queryParams = columns && columns.length ? `?columns=${columns.join(',')}` : ''
  const url = `${API_BASE_URL}/competitors/e1-data/${encodeURIComponent(snapshot)}/competitors/statistics${queryParams}`
  const response = await fetchWithError(url)
  return response.json()
}

/**
 * E1 Client API (modSTORAGE locations ONLY)
 *
 * These endpoints return only modSTORAGE client data for internal analytics.
 * Competitor data is automatically excluded by the backend.
 */

export async function getE1Client(
  snapshot: string,
  params?: {
    modstorage_location?: string
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
  const url = `${API_BASE_URL}/competitors/e1-data/${encodeURIComponent(snapshot)}/client${queryParams.toString() ? `?${queryParams}` : ""}`
  const response = await fetchWithError(url)
  return response.json()
}

export async function exportE1ClientCSV(
  snapshot: string,
  params?: {
    modstorage_location?: string
    columns?: string[]
  }
): Promise<Blob> {
  const queryParams = new URLSearchParams()
  if (params) {
    if (params.modstorage_location) queryParams.append('modstorage_location', params.modstorage_location)
    if (params.columns) queryParams.append('columns', params.columns.join(','))
  }
  const url = `${API_BASE_URL}/competitors/e1-data/${encodeURIComponent(snapshot)}/client/export/csv${queryParams.toString() ? `?${queryParams}` : ''}`
  const response = await fetchWithError(url)
  return response.blob()
}

export async function getE1ClientStatistics(
  snapshot: string,
  columns?: string[]
): Promise<ColumnStatistics[]> {
  const queryParams = columns && columns.length ? `?columns=${columns.join(',')}` : ''
  const url = `${API_BASE_URL}/competitors/e1-data/${encodeURIComponent(snapshot)}/client/statistics${queryParams}`
  const response = await fetchWithError(url)
  return response.json()
}

/**
 * Pipeline Management API
 *
 * CRUD operations for saved pipeline configurations (filters + adjusters).
 */

export async function listPipelines(): Promise<Pipeline[]> {
  const response = await fetchWithError(`${API_BASE_URL}/pipelines`)
  return response.json()
}

export async function getPipeline(pipelineId: string): Promise<Pipeline> {
  const response = await fetchWithError(`${API_BASE_URL}/pipelines/${encodeURIComponent(pipelineId)}`)
  return response.json()
}

export async function createPipeline(request: CreatePipelineRequest): Promise<Pipeline> {
  const response = await fetchWithError(`${API_BASE_URL}/pipelines`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  })
  return response.json()
}

export async function updatePipeline(pipelineId: string, request: UpdatePipelineRequest): Promise<Pipeline> {
  const response = await fetchWithError(`${API_BASE_URL}/pipelines/${encodeURIComponent(pipelineId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  })
  return response.json()
}

export async function deletePipeline(pipelineId: string): Promise<void> {
  await fetchWithError(`${API_BASE_URL}/pipelines/${encodeURIComponent(pipelineId)}`, {
    method: 'DELETE'
  })
}
