import { useTranslation } from 'react-i18next'

import { ApiError } from '@/lib/api'

/** The Italian message for an error of the match routes. */
export function useMatchErrorText() {
  const { t, i18n } = useTranslation()
  return (error: unknown): string => {
    const code = error instanceof ApiError ? error.code : 'UNKNOWN'
    const key = `match.errors.${code}`
    return i18n.exists(key) ? t(key as 'match.errors.UNKNOWN') : t('match.errors.UNKNOWN')
  }
}
