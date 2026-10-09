import { useQuery } from '@tanstack/react-query'
import { useId, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { matchApi, type GeoTreeNode } from './api'
import type { MatchDraft } from './match-draft'

export type MatchField = 'startAt' | 'maxPlayers' | 'turnHours' | 'maxDays' | 'inviteCode' | 'bots'

/** Rules shown under "advanced", grouped as in the game. */
const RULE_GROUPS: [group: string, keys: string[]][] = [
  ['start', ['minPlayersToStart', 'lateJoin']],
  // Whether there are any is chosen in the main form; here, how many and how often.
  ['bots', ['botsMax', 'botSpawnChancePct']],
  [
    'resources',
    [
      'startResources',
      'incomeBase',
      'incomePerUnit',
      'hiddenMin',
      'hiddenMax',
      'hiddenMean',
      'hiddenSd',
    ],
  ],
  ['annex', ['annexCost', 'annexPerTurn']],
  ['battle', ['attackPct', 'attackStepPct', 'attackMaxPct', 'defensePct', 'surrenderRefundPct']],
  ['capital', ['capitalMoveEveryTurns', 'accumAlertPct', 'accumAlertMinTerritories']],
  [
    'structures',
    [
      'mergeCostTurns',
      'mergeMaxUnits',
      'secondCapitalCostTurns',
      'blockCost',
      'blockTurns',
      'blockCooldownTurns',
    ],
  ],
  ['alliances', ['allianceMaxAllies', 'allianceLeaveNoticeTurns']],
  ['board', ['boardMaxChars', 'boardMessageIntervalSec']],
]

/** "Italia › Nord › Lombardia" for every folder that has municipalities. */
function areaChoices(tree: GeoTreeNode[]) {
  const byId = new Map(tree.map((node) => [node.id, node]))
  const path = (node: GeoTreeNode): string =>
    node.parentId && byId.has(node.parentId)
      ? `${path(byId.get(node.parentId)!)} › ${node.name}`
      : node.name
  return tree
    .filter((node) => node.unitCount > 0)
    .map((node) => ({ id: node.id, label: path(node), unitCount: node.unitCount }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

function Field(props: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>
        {props.label}
        {props.hint && <span className="text-muted-foreground font-normal"> {props.hint}</span>}
      </Label>
      {props.children(id)}
    </div>
  )
}

/**
 * The settings of a match. Once registrations are open only some of them
 * can still change: the others are shown but locked.
 */
export function MatchFields(props: {
  draft: MatchDraft
  onChange: (draft: MatchDraft) => void
  maxPlayersLimit: number
  /** True once the match exists: map, turn length and rules are locked. */
  locked?: boolean
  /** Fields asked elsewhere, or that this match does not have. */
  omit?: readonly MatchField[]
  /** More fields of the caller's own, placed before the rules. */
  extra?: ReactNode
}) {
  const { t } = useTranslation()
  const { draft, onChange, locked = false } = props
  const omit = new Set(props.omit)
  const set = (changes: Partial<MatchDraft>) => onChange({ ...draft, ...changes })
  const [advanced, setAdvanced] = useState(false)

  const tree = useQuery({ queryKey: ['geo', 'tree'], queryFn: matchApi.geoTree })
  const areas = useMemo(() => areaChoices(tree.data ?? []), [tree.data])

  return (
    <div className="flex flex-col gap-4">
      <Field label={t('match.form.name')}>
        {(id) => (
          <Input
            id={id}
            required
            minLength={3}
            maxLength={60}
            value={draft.name}
            onChange={(event) => set({ name: event.target.value })}
          />
        )}
      </Field>

      <Field label={t('match.form.area')}>
        {(id) => (
          <Select
            value={draft.areaId}
            onValueChange={(areaId) => set({ areaId })}
            disabled={locked}
          >
            <SelectTrigger id={id} className="w-full">
              <SelectValue
                placeholder={
                  tree.data && areas.length === 0
                    ? t('match.form.noAreas')
                    : t('match.form.areaPlaceholder')
                }
              />
            </SelectTrigger>
            <SelectContent>
              {areas.map((area) => (
                <SelectItem key={area.id} value={area.id}>
                  {area.label} ({t('match.units', { count: area.unitCount })})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>

      {!omit.has('startAt') && (
        <Field label={t('match.form.startAt')}>
          {(id) => (
            <Input
              id={id}
              type="datetime-local"
              required
              value={draft.startAt}
              onChange={(event) => set({ startAt: event.target.value })}
            />
          )}
        </Field>
      )}

      {!(omit.has('maxPlayers') && omit.has('turnHours')) && (
        <div className="grid grid-cols-2 gap-4">
          {!omit.has('maxPlayers') && (
            <Field label={t('match.form.maxPlayers')}>
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  required
                  min={2}
                  max={props.maxPlayersLimit}
                  value={draft.maxPlayers}
                  onChange={(event) => set({ maxPlayers: event.target.value })}
                />
              )}
            </Field>
          )}
          {!omit.has('turnHours') && (
            <Field label={t('match.form.turnHours')} hint={t('match.form.hours')}>
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  required
                  min={30 / 3600}
                  step="any"
                  disabled={locked}
                  value={draft.turnHours}
                  onChange={(event) => set({ turnHours: event.target.value })}
                />
              )}
            </Field>
          )}
        </div>
      )}

      {!omit.has('maxDays') && (
        <Field label={t('match.form.maxDays')} hint={t('match.form.optional')}>
          {(id) => (
            <Input
              id={id}
              type="number"
              min={1}
              placeholder={t('match.form.noEnd')}
              value={draft.maxDays}
              onChange={(event) => set({ maxDays: event.target.value })}
            />
          )}
        </Field>
      )}

      {!omit.has('inviteCode') && (
        <Field label={t('match.form.inviteCode')} hint={t('match.form.optional')}>
          {(id) => (
            <Input
              id={id}
              minLength={4}
              maxLength={32}
              placeholder={t('match.form.inviteCodeHint')}
              value={draft.inviteCode}
              onChange={(event) => set({ inviteCode: event.target.value })}
            />
          )}
        </Field>
      )}

      {/* One player is enough: the other empires can be played by the server. */}
      {!omit.has('bots') && 'botsEnabled' in draft.config && (
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2 font-bold">
            <input
              type="checkbox"
              className="accent-primary size-4"
              disabled={locked}
              checked={draft.config.botsEnabled === true}
              onChange={(event) =>
                set({ config: { ...draft.config, botsEnabled: event.target.checked } })
              }
            />
            {t('match.form.bots')}
          </label>
          <p className="text-muted-foreground text-base">{t('match.form.botsHint')}</p>
        </div>
      )}

      {props.extra}

      <div className="rounded-md border">
        <button
          type="button"
          aria-expanded={advanced}
          className="hover:bg-accent flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left font-bold"
          onClick={() => setAdvanced((value) => !value)}
        >
          {t('match.form.rules')}
          <span aria-hidden="true">{advanced ? '−' : '+'}</span>
        </button>
        {advanced && (
          <div className="flex flex-col gap-4 p-3">
            {locked && <p className="text-muted-foreground">{t('match.form.rulesLocked')}</p>}
            {RULE_GROUPS.map(([group, keys]) => (
              <fieldset key={group} className="flex flex-col gap-2" disabled={locked}>
                <legend className="font-display mb-1 text-base">
                  {t(`match.ruleGroups.${group}` as 'match.ruleGroups.start')}
                </legend>
                {keys
                  .filter((key) => key in draft.config)
                  .map((key) => {
                    const value = draft.config[key]
                    const label = t(`match.rules.${key}` as 'match.rules.annexCost')
                    const setRule = (next: string | boolean) =>
                      set({ config: { ...draft.config, [key]: next } })
                    return typeof value === 'boolean' ? (
                      <label key={key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="accent-primary size-4"
                          checked={value}
                          onChange={(event) => setRule(event.target.checked)}
                        />
                        {label}
                      </label>
                    ) : (
                      <label key={key} className="grid grid-cols-[1fr_6rem] items-center gap-3">
                        <span>{label}</span>
                        <Input
                          type="number"
                          required
                          min={0}
                          step="any"
                          aria-label={label}
                          value={value}
                          onChange={(event) => setRule(event.target.value)}
                        />
                      </label>
                    )
                  })}
              </fieldset>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
