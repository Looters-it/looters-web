/** How many errors a page reports before it stops: a loop must not flood the server. */
const MAX_REPORTS = 5

let sent = 0
const seen = new Set<string>()

/**
 * Tells the server about an error of the interface, so that it shows up in
 * the logs (PROMPT §7: nobody should need a screenshot from a player). It
 * sends the message, the stack and the path of the page: never what the
 * player typed, nor the query string. Reporting never fails loudly.
 */
export function reportError(
  error: unknown,
  kind: 'render' | 'error' | 'rejection',
  path = window.location.pathname,
): void {
  const message = error instanceof Error ? error.message : String(error)
  if (sent >= MAX_REPORTS || seen.has(message)) return
  seen.add(message)
  sent += 1
  try {
    void fetch('/api/client-errors', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        message: message.slice(0, 2000),
        stack: error instanceof Error ? error.stack?.slice(0, 8000) : undefined,
        path: path.slice(0, 500),
        kind,
      }),
    }).catch(() => undefined)
  } catch {
    // Nothing to do: the report is a courtesy.
  }
}

/** Reports what no component caught: script errors and promises nobody awaited. */
export function reportUncaughtErrors(): void {
  window.addEventListener('error', (event) => reportError(event.error ?? event.message, 'error'))
  window.addEventListener('unhandledrejection', (event) => reportError(event.reason, 'rejection'))
}

/** For tests: forget what was reported. */
export function resetReports(): void {
  sent = 0
  seen.clear()
}
