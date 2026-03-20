export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '')

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function fetchWithError(url: string, options?: RequestInit): Promise<Response> {
  // Guardrail: if the API base URL isn't configured, `${API_BASE_URL}/...` becomes a
  // same-origin relative request and can return the Next.js app HTML with a 200.
  // That looks "successful" but produces empty/invalid data.
  if (url.startsWith('/') && !API_BASE_URL) {
    throw new ApiError(
      0,
      'NEXT_PUBLIC_API_URL is not set. Configure it (e.g. http://localhost:8000) so the UI can load competitor data.'
    )
  }

  const response = await fetch(url, options)

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new ApiError(response.status, errorText)
  }

  return response
}
