export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '')

// Hard ceiling for any single request. The pricing-data endpoint can legitimately
// take 10-20s to compute a snapshot, so this is deliberately generous — its job
// is only to stop a hung connection from spinning forever with no way out.
const DEFAULT_TIMEOUT_MS = 25_000

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export type FetchWithErrorOptions = RequestInit & { timeoutMs?: number }

export async function fetchWithError(url: string, options?: FetchWithErrorOptions): Promise<Response> {
  // Guardrail: if the API base URL isn't configured, `${API_BASE_URL}/...` becomes a
  // same-origin relative request and can return the Next.js app HTML with a 200.
  // That looks "successful" but produces empty/invalid data.
  if (url.startsWith('/') && !API_BASE_URL) {
    throw new ApiError(
      0,
      'NEXT_PUBLIC_API_URL is not set. Configure it (e.g. http://localhost:8000) so the UI can load competitor data.'
    )
  }

  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: callerSignal, ...init } = options ?? {}

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  // Respect a caller-provided AbortSignal on top of our timeout.
  const onCallerAbort = () => controller.abort()
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort()
    else callerSignal.addEventListener('abort', onCallerAbort, { once: true })
  }

  let response: Response
  try {
    response = await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    if (timedOut) {
      throw new ApiError(0, `Request timed out after ${Math.round(timeoutMs / 1000)}s`)
    }
    if (err instanceof ApiError) throw err
    const name = (err as Error)?.name
    if (name === 'AbortError') {
      throw new ApiError(0, 'Request was cancelled')
    }
    throw new ApiError(0, (err as Error)?.message || 'Network request failed')
  } finally {
    clearTimeout(timer)
    callerSignal?.removeEventListener('abort', onCallerAbort)
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new ApiError(response.status, errorText)
  }

  return response
}
