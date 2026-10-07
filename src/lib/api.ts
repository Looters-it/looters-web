/** Shape of every API error (docs/ARCHITECTURE.md). */
export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

interface RequestOptions {
  /** Statuses whose JSON body is a valid answer rather than an error. */
  accept?: number[]
  signal?: AbortSignal
}

/** GET on the API. The session cookie travels with the request (same origin). */
export async function apiGet<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    signal: options.signal,
  })
  if (response.ok || options.accept?.includes(response.status)) {
    return (await response.json()) as T
  }
  const body = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string }
  } | null
  throw new ApiError(
    response.status,
    body?.error?.code ?? 'UNKNOWN',
    body?.error?.message ?? response.statusText,
  )
}

export interface SystemStatus {
  status: 'ok' | 'unavailable'
  database: boolean
  jobs: { lastPongAt: string | null }
  battleQueue: boolean
}

export function getSystemStatus(signal?: AbortSignal): Promise<SystemStatus> {
  // 503 carries the same body, with `database: false`.
  return apiGet<SystemStatus>('/health/ready', { accept: [503], signal })
}
