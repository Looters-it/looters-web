import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import type { MapUnit } from '@/features/map/GameMap'
import { cn } from '@/lib/utils'

const MAX_RESULTS = 8

/**
 * Finds a municipality by name: the way to select one without pointing at
 * the map, for who uses a keyboard or a screen reader (WCAG 2.1.1). It floats
 * over the map, in its top left corner.
 */
export function UnitSearch(props: {
  units: readonly { id: number; name: string }[]
  onSelect: (unit: MapUnit) => void
  className?: string
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
    // Over the map: the field is a pill of the page's own colour, and what it finds
    // drops down under it.
    <div className={cn('relative', props.className)}>
      <label htmlFor={inputId} className="sr-only">
        {t('game.search.label')}
      </label>
      <Input
        id={inputId}
        type="search"
        autoComplete="off"
        placeholder={t('game.search.label')}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="bg-background border-transparent shadow-md"
      />
      <div role="status" className="sr-only">
        {query.length >= 2 && t('game.search.found', { count: matches.length })}
      </div>
      {query.length >= 2 && (
        <div className="bg-background absolute inset-x-0 top-full mt-2 overflow-hidden rounded-[1.375rem] shadow-md">
          {matches.length === 0 ? (
            <p className="text-muted-foreground px-5 py-2.5 text-base">{t('game.search.none')}</p>
          ) : (
            <ul className="flex flex-col p-1.5" aria-label={t('game.search.results')}>
              {matches.slice(0, MAX_RESULTS).map((unit) => (
                <li key={unit.id}>
                  <button
                    type="button"
                    className="hover:bg-accent rounded-pill w-full cursor-pointer px-4 py-1.5 text-left transition-colors"
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
                <li className="text-muted-foreground px-4 py-1.5 text-base">
                  {t('game.search.more', { count: matches.length - MAX_RESULTS })}
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
