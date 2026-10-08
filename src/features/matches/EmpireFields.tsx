import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import type { EmpireIdentity } from './api'
import { EmblemGlyph, EmpireShield } from './Emblem'

/** Name, colour, emblem and motto of an empire, with a live preview of its coat of arms. */
export function EmpireFields(props: {
  value: EmpireIdentity
  onChange: (value: EmpireIdentity) => void
  colors: string[]
  emblems: string[]
  /** Colours of the other empires of the match: a colour is unique. */
  takenColors: ReadonlySet<string>
}) {
  const { t } = useTranslation()
  const nameId = useId()
  const mottoId = useId()
  const { value, onChange } = props
  const set = (changes: Partial<EmpireIdentity>) => onChange({ ...value, ...changes })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <EmpireShield color={value.color} emblem={value.emblem} className="size-12" />
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor={nameId}>{t('match.empire.name')}</Label>
          <Input
            id={nameId}
            required
            minLength={3}
            maxLength={40}
            value={value.name}
            onChange={(event) => set({ name: event.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="leading-none font-medium">{t('match.empire.color')}</span>
        <div
          role="group"
          aria-label={t('match.empire.color')}
          className="grid max-h-40 grid-cols-[repeat(auto-fill,minmax(1.75rem,1fr))] gap-1.5 overflow-y-auto rounded-md border p-2"
        >
          {props.colors.map((color, index) => {
            const taken = props.takenColors.has(color)
            const label = t('match.empire.colorOf', { n: index + 1 })
            return (
              <button
                key={color}
                type="button"
                aria-pressed={color === value.color}
                aria-label={taken ? `${label}, ${t('match.empire.colorTaken')}` : label}
                disabled={taken}
                onClick={() => set({ color })}
                style={{ backgroundColor: color }}
                className={cn(
                  'border-border aspect-square cursor-pointer rounded-full border transition-transform hover:scale-110',
                  color === value.color &&
                    'ring-foreground ring-offset-background ring-2 ring-offset-2',
                  // Taken colours are crossed out, not just faded: never colour alone.
                  taken &&
                    'cursor-not-allowed bg-[linear-gradient(45deg,transparent_45%,var(--color-ink)_45%,var(--color-ink)_55%,transparent_55%)] opacity-40 hover:scale-100',
                )}
              />
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="leading-none font-medium">{t('match.empire.emblem')}</span>
        <div role="group" aria-label={t('match.empire.emblem')} className="flex flex-wrap gap-2">
          {props.emblems.map((emblem) => (
            <button
              key={emblem}
              type="button"
              aria-pressed={emblem === value.emblem}
              aria-label={t('match.empire.emblemOf', {
                name: t(`match.empire.emblems.${emblem}` as 'match.empire.emblems.torre'),
              })}
              onClick={() => set({ emblem })}
              className={cn(
                'grid size-11 cursor-pointer place-items-center rounded-full border transition-transform hover:scale-110',
                emblem === value.emblem
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border',
              )}
            >
              <EmblemGlyph emblem={emblem} className="size-5" />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={mottoId}>
          {t('match.empire.motto')}{' '}
          <span className="text-muted-foreground font-normal">{t('match.form.optional')}</span>
        </Label>
        <Input
          id={mottoId}
          maxLength={80}
          placeholder={t('match.empire.mottoHint')}
          value={value.motto ?? ''}
          onChange={(event) => set({ motto: event.target.value || null })}
        />
      </div>
    </div>
  )
}
