import { API_BASE_URL, fetchWithError } from "./shared"

export interface LocationPayload {
  name: string
  address: string
  city: string
  state: string
  zip: string
  radius_meters: number | null
}

export async function saveLocations(locations: LocationPayload[]): Promise<{ success: boolean }> {
  const response = await fetchWithError(`${API_BASE_URL}/locations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locations }),
  })
  return response.json()
}

export async function getLocations(): Promise<{ locations: LocationPayload[] } | LocationPayload[]> {
  const response = await fetchWithError(`${API_BASE_URL}/get-locations`)
  return response.json()
}
