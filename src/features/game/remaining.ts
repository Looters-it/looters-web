/** "1g 03:25:10" or "03:25:10": what is left before a moment, never below zero. */
export function formatRemaining(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000))
  const pad = (value: number) => String(value).padStart(2, '0')
  const days = Math.floor(total / 86_400)
  const clock = `${pad(Math.floor((total % 86_400) / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
  return days > 0 ? `${days}g ${clock}` : clock
}
