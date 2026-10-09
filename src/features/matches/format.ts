import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/** Dates in the interface language, and "in 3 days" style distances. */
export function useMatchFormat() {
  const { i18n } = useTranslation()
  const dateTime = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' })
  const relative = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' })

  return {
    dateTime: (iso: string) => dateTime.format(new Date(iso)),
    /** The day alone, written out: "12 ottobre 2026". */
    date: (iso: string) => date.format(new Date(iso)),
    /** How far a moment is from now, in the largest fitting unit. */
    fromNow: (iso: string, now = Date.now()) => {
      const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
      const steps: [Intl.RelativeTimeFormatUnit, number][] = [
        ['day', 86_400],
        ['hour', 3600],
        ['minute', 60],
      ]
      for (const [unit, size] of steps) {
        if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit)
      }
      return relative.format(seconds, 'second')
    },
  }
}

/** The value a `datetime-local` input wants for a moment, in local time. */
export function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** The current time, refreshed now and then, for texts that depend on it. */
export function useNow(everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(timer)
  }, [everyMs])
  return now
}
