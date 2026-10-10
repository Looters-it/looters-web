import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  matchApi,
  type CatalogueEntry,
  type MatchState,
  type Structure,
} from '@/features/matches/api'
import { useMatchErrorText } from '@/features/matches/errors'

/** Names and descriptions of a structure; one the interface does not know yet shows its key. */
function useStructureText() {
  const { t, i18n } = useTranslation()
  return {
    name: (type: string) => {
      const key = `game.structures.types.${type}`
      return i18n.exists(key) ? t(key as 'game.structures.types.BLOCK') : type
    },
    description: (entry: CatalogueEntry) => {
      const key = `game.structures.descriptions.${entry.type}`
      const values = { turns: entry.durationTurns ?? 0, cooldown: entry.cooldownTurns }
      return i18n.exists(key)
        ? t(key as 'game.structures.descriptions.BLOCK', values)
        : entry.durationTurns === null
          ? t('game.structures.permanent')
          : t('game.structures.unknownDescription', values)
    },
  }
}

function StructureCard(props: {
  state: MatchState
  entry: CatalogueEntry
  /** The territory picked for this card, in the select or on the map. */
  territoryId: string | null
  onPick: (territoryId: string) => void
  active: boolean
  onActivate: () => void
}) {
  const { t } = useTranslation()
  const text = useStructureText()
  const errorText = useMatchErrorText()
  const queryClient = useQueryClient()
  const selectId = useId()
  const { state, entry } = props
  const matchId = state.match.id
  const site = entry.sites.find((candidate) => candidate.territoryId === props.territoryId)

  const build = useMutation({
    mutationFn: () =>
      matchApi.build(matchId, {
        type: entry.type,
        territoryId: props.territoryId ?? '',
        turn: state.match.currentTurn,
      }),
    onSuccess: (next) => {
      queryClient.setQueryData(['matches', 'state', matchId], next)
      return queryClient.invalidateQueries({ queryKey: ['matches', 'catalogue', matchId] })
    },
  })

  return (
    <li
      className={`flex flex-col gap-2 rounded-md border p-3 ${props.active ? 'border-foreground' : ''}`}
    >
      <h3 className="text-base">{text.name(entry.type)}</h3>
      <p className="text-muted-foreground text-base">{text.description(entry)}</p>
      <p className="font-bold">{t('game.structures.cost', { count: entry.cost })}</p>

      <div className="flex flex-col gap-1">
        <Label htmlFor={selectId}>{t('game.structures.where')}</Label>
        <Select
          value={props.territoryId ?? ''}
          onOpenChange={(open) => open && props.onActivate()}
          onValueChange={(territoryId) => {
            build.reset()
            props.onActivate()
            props.onPick(territoryId)
          }}
        >
          <SelectTrigger id={selectId} className="w-full">
            <SelectValue placeholder={t('game.structures.wherePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {entry.sites.map((candidate) => (
              <SelectItem key={candidate.territoryId} value={candidate.territoryId}>
                {t('game.structures.siteOption', {
                  name: candidate.name,
                  count: candidate.resources,
                })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* The reason is always spelled out when it cannot be built. */}
      {site?.blocked && (
        <p className="text-danger">
          {t(`game.structures.blocked.${site.blocked}` as 'game.structures.blocked.IN_BATTLE')}
        </p>
      )}
      {build.error && (
        <p role="alert" className="text-danger">
          {errorText(build.error)}
        </p>
      )}
      <Button
        className="self-start"
        disabled={!site || site.blocked !== null || build.isPending}
        onClick={() => build.mutate()}
      >
        {t('game.structures.build')}
      </Button>
    </li>
  )
}

/** Moves a structure that can change territory (the second capital) to another own territory. */
function MoveStructure({ state, structure }: { state: MatchState; structure: Structure }) {
  const { t } = useTranslation()
  const errorText = useMatchErrorText()
  const queryClient = useQueryClient()
  const selectId = useId()
  const [to, setTo] = useState('')
  const matchId = state.match.id
  const capital = state.empires.find(
    (empire) => empire.id === state.me?.empireId,
  )?.capitalTerritoryId
  // Anywhere of one's own but where it is now; the capital already is one.
  const destinations = state.territories.filter(
    (territory) =>
      territory.ownerEmpireId === state.me?.empireId &&
      territory.id !== structure.territoryId &&
      territory.id !== capital,
  )
  const move = useMutation({
    mutationFn: () =>
      matchApi.moveStructure(matchId, structure.id, {
        territoryId: to,
        turn: state.match.currentTurn,
      }),
    onSuccess: (next) => {
      queryClient.setQueryData(['matches', 'state', matchId], next)
      setTo('')
    },
  })

  if ((structure.moveInTurns ?? 0) > 0) {
    return (
      <p className="text-muted-foreground text-base">
        {t('game.structures.moveWait', { count: structure.moveInTurns })}
      </p>
    )
  }
  if (destinations.length === 0) {
    return <p className="text-muted-foreground text-base">{t('game.structures.moveNowhere')}</p>
  }
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={selectId}>{t('game.structures.moveTo')}</Label>
      <div className="flex gap-2">
        <Select
          value={to}
          onValueChange={(value) => {
            move.reset()
            setTo(value)
          }}
        >
          <SelectTrigger id={selectId} className="w-full">
            <SelectValue placeholder={t('game.structures.wherePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {destinations.map((territory) => (
              <SelectItem
                key={territory.id}
                value={territory.id}
                disabled={territory.battleId !== null}
              >
                {territory.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" disabled={!to || move.isPending} onClick={() => move.mutate()}>
          {t('game.structures.move')}
        </Button>
      </div>
      {move.error && (
        <p role="alert" className="text-danger">
          {errorText(move.error)}
        </p>
      )}
    </div>
  )
}

/**
 * The catalogue of structures as cards. Whatever the api lists is shown:
 * a structure added to the catalogue appears here without a change.
 */
export function BuildPage(props: {
  state: MatchState
  /** The structure the map is choosing a territory for, and the territory chosen. */
  picking: { type: string; territoryId: string | null } | null
  onPicking: (picking: { type: string; territoryId: string | null }) => void
}) {
  const { t } = useTranslation()
  const text = useStructureText()
  const { state } = props
  const catalogue = useQuery({
    queryKey: ['matches', 'catalogue', state.match.id, state.match.currentTurn],
    queryFn: () => matchApi.catalogue(state.match.id),
  })
  const mine = state.structures.filter((structure) => structure.empireId === state.me?.empireId)
  const nameOf = (territoryId: string) =>
    state.territories.find((territory) => territory.id === territoryId)?.name ?? ''

  return (
    <section className="flex flex-col gap-4" aria-labelledby="build-title">
      <h2 id="build-title" className="sr-only">
        {t('game.structures.title')}
      </h2>
      <p className="text-muted-foreground text-base">{t('game.structures.intro')}</p>
      <ul className="flex flex-col gap-3">
        {catalogue.data?.map((entry) => (
          <StructureCard
            key={entry.type}
            state={state}
            entry={entry}
            active={props.picking?.type === entry.type}
            territoryId={props.picking?.type === entry.type ? props.picking.territoryId : null}
            onActivate={() =>
              props.picking?.type !== entry.type &&
              props.onPicking({ type: entry.type, territoryId: null })
            }
            onPick={(territoryId) => props.onPicking({ type: entry.type, territoryId })}
          />
        ))}
      </ul>

      <div className="flex flex-col gap-2 pt-4">
        <h3 className="text-base">{t('game.structures.active')}</h3>
        {mine.length === 0 && <p className="text-muted-foreground">{t('game.structures.none')}</p>}
        <ul className="flex flex-col gap-1">
          {mine.map((structure) => (
            <li key={structure.id} className="flex flex-col gap-2 py-2">
              <div className="flex justify-between gap-3">
                <span>
                  {t('game.structures.activeItem', {
                    type: text.name(structure.type),
                    name: nameOf(structure.territoryId),
                  })}
                </span>
                <span className="text-muted-foreground">
                  {structure.turnsLeft === null
                    ? t('game.structures.permanent')
                    : t('game.structures.turnsLeft', { count: structure.turnsLeft })}
                </span>
              </div>
              {structure.moveInTurns != null && (
                <MoveStructure state={state} structure={structure} />
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
