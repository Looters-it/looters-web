import { useTranslation } from 'react-i18next'

import type { BoardEntry } from '@/features/matches/api'

/** The text of an announcement, written from its type and the names it carries. */
export function useEntryText() {
  const { t, i18n } = useTranslation()
  return (entry: BoardEntry): string => {
    if (entry.type === 'MESSAGE') return entry.data.text ?? ''
    const suffix = entry.type === 'BATTLE_RESOLVED' ? `_${entry.data.outcome}` : ''
    const key = `game.board.events.${entry.type}${suffix}`
    return i18n.exists(key)
      ? t(
          key as 'game.board.events.ANNEXED',
          entry.data as { empireName: string; territoryName: string },
        )
      : t('game.board.events.UNKNOWN')
  }
}
