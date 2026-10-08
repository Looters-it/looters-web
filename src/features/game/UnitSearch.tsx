import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { MapUnit } from '@/features/map/GameMap'

const MAX_RESULTS = 8

/**
 * Finds a municipality by name: the way to select one without pointing at
 * the map, for who uses a keyboard or a screen reader (WCAG 2.1.1).
 */
export function UnitSearch(props: {
  units: readonly { id: number; name: string }[]
  onSelect: (unit: MapUnit) => void
}) {
  const { t } = useTranslation()
  const inputId = useId()
  const [text, setText] = useState('')
  const query = text.trim().toLocaleLowerCase('it')
  const matches =
    query.length < 2
      ? []
      : props.units
          .filter((unit) => unit.name.toLocaleLowerCase('it').includes(query))
          // Names that start with what was typed come first.
          .sort(
            (a, b) =>
              Number(b.name.toLocaleLowerCase('it').startsWith(query)) -
                Number(a.name.toLocaleLowerCase('it').startsWith(query)) ||
              a.name.localeCompare(b.name, 'it'),
          )

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={inputId}>{t('game.search.label')}</Label>
      <Input
        id={inputId}
        type="search"
        autoComplete="off"
        placeholder={t('game.search.placeholder')}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <div role="status" className="sr-only">
        {query.length >= 2 && t('game.search.found', { count: matches.length })}
      </div>
      {query.length >= 2 && matches.length === 0 && (
        <p className="text-muted-foreground text-base">{t('game.search.none')}</p>
      )}
      {matches.length > 0 && (
        <ul className="flex flex-col rounded-md border" aria-label={t('game.search.results')}>
          {matches.slice(0, MAX_RESULTS).map((unit) => (
            <li key={unit.id} className="">
              <button
                type="button"
                className="hover:bg-accent w-full cursor-pointer px-3 py-2 text-left transition-colors"
                onClick={() => {
                  props.onSelect({ id: unit.id, name: unit.name })
                  setText('')
                }}
              >
                {unit.name}
              </button>
            </li>
          ))}
          {matches.length > MAX_RESULTS && (
            <li className="text-muted-foreground px-3 py-2 text-base">
              {t('game.search.more', { count: matches.length - MAX_RESULTS })}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
