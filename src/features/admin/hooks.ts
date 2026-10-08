import { useTranslation } from 'react-i18next'

import { ApiError } from '@/lib/api'

/** Translation key of an API error, falling back to a generic message. */
export function useErrorText() {
  const { t, i18n } = useTranslation()
  return (error: unknown): string => {
    const code = error instanceof ApiError ? error.code : 'UNKNOWN'
    const key = `admin.errors.${code}`
    return i18n.exists(key) ? t(key as 'admin.errors.UNKNOWN') : t('admin.errors.UNKNOWN')
  }
}

/** Dates and numbers in the interface language. */
export function useFormat() {
  const { i18n } = useTranslation()
  const dateTime = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'short',
    timeStyle: 'short',
  })
  const number = new Intl.NumberFormat(i18n.language)
  return {
    dateTime: (iso: string) => dateTime.format(new Date(iso)),
    number: (value: number) => number.format(value),
    megabytes: (bytes: number) =>
      new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(bytes / 1_048_576),
  }
}
