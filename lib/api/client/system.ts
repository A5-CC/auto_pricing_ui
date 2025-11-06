import { API_BASE_URL, fetchWithError } from './shared'

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
