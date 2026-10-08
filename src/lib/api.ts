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

async function request<T>(
  method: string,
  path: string,
  body: unknown,
  options: RequestOptions,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    // The session cookie travels with the request (same origin).
    credentials: 'same-origin',
    signal: options.signal,
    ...(body === undefined
      ? {}
      : body instanceof FormData
        ? { body } // the browser sets the multipart boundary itself
        : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  })
  if (response.status === 204) return undefined as T
  if (response.ok || options.accept?.includes(response.status)) {
    return (await response.json()) as T
  }
  const payload = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string }
  } | null
  throw new ApiError(
    response.status,
    payload?.error?.code ?? 'UNKNOWN',
    payload?.error?.message ?? response.statusText,
  )
}

export function apiGet<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return request<T>('GET', path, undefined, options)
}

export function apiPost<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
  return request<T>('POST', path, body, options)
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>('PATCH', path, body, {})
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return request<T>('PUT', path, body, {})
}

export function apiDelete<T = void>(path: string, body?: unknown): Promise<T> {
  return request<T>('DELETE', path, body, {})
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
