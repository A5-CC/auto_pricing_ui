import { RunResponse, RunStatus } from '@/lib/api/types'
import { API_BASE_URL, fetchWithError } from './shared'

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
