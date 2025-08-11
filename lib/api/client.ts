import { DashboardData } from "@/components/analytics/types"
import { UploadResponse, JobStatus, DocMeta, RunResponse, RunStatus, URLDumpDetail, URLDumpSummary } from "./types"

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

export async function triggerPipelineRun(force = false): Promise<RunResponse> {
  const response = await fetchWithError(`${API_BASE_URL}/competitors/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force })
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