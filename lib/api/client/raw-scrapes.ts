import {
  RawScrapeDateSummary,
  RawScrapeDetail,
  RawScrapeSummary,
  RawScrapeRunSummary
} from '@/lib/api/types'
import { API_BASE_URL, fetchWithError } from './shared'

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
