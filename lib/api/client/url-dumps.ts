import { URLDumpDetail, URLDumpSummary } from '@/lib/api/types'
import { API_BASE_URL, fetchWithError } from './shared'

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
