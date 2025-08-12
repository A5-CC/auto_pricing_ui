import { DashboardData } from "@/components/analytics/types"
import {
  UploadResponse,
  JobStatus,
  DocMeta,
  RunResponse,
  RunStatus,
  URLDumpDetail,
  URLDumpSummary,
  RawScrapeDateSummary,
  RawScrapeDetail,
  RawScrapeSummary,
  RawScrapeRunSummary,
  PricingSchemas,
  SchemaStats,
  PricingSnapshot,
  PricingDataResponse,
  FacilityPricingData,
  ColumnStatistics,
} from "./types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || ''

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function fetchWithError(url: string, options?: RequestInit): Promise<Response> {
  const response = await fetch(url, options)

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new ApiError(response.status, errorText)
  }

  return response
}

//FIXME: This is from auto analyst fork; remove the type and all references to it
export async function uploadFiles(files: File[]): Promise<UploadResponse> {
  const formData = new FormData()
  files.forEach(file => {
    formData.append('files', file)
  })

  const response = await fetchWithError(`${API_BASE_URL}/upload`, {
    method: 'POST',
    body: formData,
  })

  return response.json()
}

//FIXME: This is from auto analyst fork; remove the type and all references to it
export async function checkJobStatus(jobId: string): Promise<JobStatus> {
  const response = await fetchWithError(`${API_BASE_URL}/job-status/${jobId}`)
  return response.json()
}

//FIXME: This is from auto analyst fork; remove the type and all references to it
export async function getDocumentList(): Promise<DocMeta[]> {
  const response = await fetchWithError(`${API_BASE_URL}/list-jobs`)
  const data = await response.json()
  // El backend devuelve { documents: DocMeta[] }, extraemos solo el array
  return data.documents || data
}

//FIXME: This is from auto analyst fork; remove the type and all references to it
export async function getSummaryById(docId: string): Promise<DashboardData> {
  const response = await fetchWithError(`${API_BASE_URL}/summary/${docId}`)
  return response.json()
}

export async function getSystemHealth(): Promise<{ status: string; timestamp: string }> {
  try {
    // Try the /health endpoint first (returns plain text "OK")
    const healthResponse = await fetchWithError(`${API_BASE_URL}/health`)
    const healthText = await healthResponse.text()

    if (healthText.trim() === 'OK') {
      return { status: 'ok', timestamp: new Date().toISOString() }
    }

    // Fallback to root endpoint if health doesn't return "OK"
    const rootResponse = await fetchWithError(`${API_BASE_URL}/`)
    const rootData = await rootResponse.json()

    return {
      status: rootData.status || 'unknown',
      timestamp: new Date().toISOString()
    }
  } catch {
    return { status: 'offline', timestamp: new Date().toISOString() }
  }
}

export async function getVersionInfo(): Promise<{ version: string; release_date: string; api: string } | null> {
  try {
    const response = await fetchWithError(`${API_BASE_URL}/version`)
    return response.json()
  } catch {
    return null
  }
}

// Runs page API
export async function getLatestRunStatus(): Promise<RunStatus> {
  const response = await fetchWithError(`${API_BASE_URL}/competitors/run-status/latest`)
  return response.json()
}

export async function getRunHistory(): Promise<{ runs: RunStatus[] }> {
  const response = await fetchWithError(`${API_BASE_URL}/competitors/run-status/history`)
  return response.json()
}

export async function triggerPipelineRun(overwrite = false): Promise<RunResponse> {
  const response = await fetchWithError(`${API_BASE_URL}/competitors/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ overwrite })
  })
  return response.json()
}

// URL Dumps explorer API
export async function getURLDumps(limit = 30): Promise<URLDumpSummary[]> {
  const response = await fetchWithError(`${API_BASE_URL}/competitors/competitor-urls?limit=${limit}`)
  return response.json()
}

export async function getURLDumpDetail(timestamp: string): Promise<URLDumpDetail> {
  const response = await fetchWithError(`${API_BASE_URL}/competitors/competitor-urls/${timestamp}`)
  return response.json()
}

export async function getLatestURLDump(): Promise<URLDumpDetail | null> {
  const response = await fetchWithError(`${API_BASE_URL}/competitors/competitor-urls/latest/detail`)
  return response.json()
}

// Raw scrapes explorer API
export async function getRawScrapeDates(limit = 30): Promise<RawScrapeDateSummary[]> {
  const response = await fetchWithError(`${API_BASE_URL}/competitors/raw-scrapes?limit=${limit}`)
  return response.json()
}

export async function getRawScrapesForDate(date: string): Promise<RawScrapeSummary[]> {
  const response = await fetchWithError(`${API_BASE_URL}/competitors/raw-scrapes/${date}`)
  return response.json()
}

export async function getRawScrapeDetail(date: string, filename: string): Promise<RawScrapeDetail> {
  const response = await fetchWithError(`${API_BASE_URL}/competitors/raw-scrapes/${date}/${encodeURIComponent(filename)}`)
  return response.json()
}

export async function getRawScrapeRunSummary(date: string): Promise<RawScrapeRunSummary | null> {
  const response = await fetchWithError(`${API_BASE_URL}/competitors/raw-scrapes/${date}/_run`)
  return response.json()
}

// Pricing Schemas API
export async function getPricingSchemas(): Promise<PricingSchemas> {
  const response = await fetchWithError(`${API_BASE_URL}/competitors/pricing-schemas`)
  return response.json()
}

export async function getSchemaStats(): Promise<SchemaStats> {
  const response = await fetchWithError(`${API_BASE_URL}/competitors/pricing-schemas/columns/stats`)
  return response.json()
}

// Pricing data API
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