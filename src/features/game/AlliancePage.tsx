import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfirmDialog } from '@/features/admin/shared'
import { matchApi, type MatchState } from '@/features/matches/api'
import { EmpireShield } from '@/features/matches/Emblem'
import { useMatchErrorText } from '@/features/matches/errors'

type Act = (run: () => Promise<MatchState>) => void

/** Sending resources from an own territory to a territory of an ally. */
function Transfer({ state, allies }: { state: MatchState; allies: Set<string> }) {
  const { t } = useTranslation()
  const errorText = useMatchErrorText()
  const queryClient = useQueryClient()
  const fromId = useId()
  const toId = useId()
  const amountId = useId()
  const matchId = state.match.id
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')

  const mine = state.territories.filter((t) => t.ownerEmpireId === state.me?.empireId)
  const theirs = state.territories.filter((t) => allies.has(t.ownerEmpireId))
  const empireName = (id: string) => state.empires.find((e) => e.id === id)?.name ?? ''
  const source = mine.find((territory) => territory.id === from)

  const send = useMutation({
    mutationFn: () =>
      matchApi.transfer(matchId, {
        fromTerritoryId: from,
        toTerritoryId: to,
        amount: Number(amount),
        turn: state.match.currentTurn,
      }),
    onSuccess: (next) => {
      queryClient.setQueryData(['matches', 'state', matchId], next)
      setAmount('')
    },
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    send.mutate()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 pt-4">
      <h3 className="text-base">{t('game.alliance.transfer')}</h3>
      <div className="flex flex-col gap-1">
        <Label htmlFor={fromId}>{t('game.alliance.transferFrom')}</Label>
        <Select value={from} onValueChange={setFrom}>
          <SelectTrigger id={fromId} className="w-full">
            <SelectValue placeholder={t('game.structures.wherePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {mine.map((territory) => (
              <SelectItem
                key={territory.id}
                value={territory.id}
                disabled={territory.battleId !== null}
              >
                {t('game.alliance.territoryOption', {
                  name: territory.name,
                  count: territory.resources ?? 0,
                })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={toId}>{t('game.alliance.transferTo')}</Label>
        <Select value={to} onValueChange={setTo}>
          <SelectTrigger id={toId} className="w-full">
            <SelectValue placeholder={t('game.structures.wherePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {theirs.map((territory) => (
              <SelectItem
                key={territory.id}
                value={territory.id}
                disabled={territory.battleId !== null}
              >
                {t('game.alliance.allyOption', {
                  name: territory.name,
                  empire: empireName(territory.ownerEmpireId),
                  count: territory.resources ?? 0,
                })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={amountId}>{t('game.alliance.amount')}</Label>
        <Input
          id={amountId}
          type="number"
          required
          min={1}
          max={source?.resources ?? undefined}
          value={amount}
          onChange={(event) => {
            send.reset()
            setAmount(event.target.value)
          }}
        />
      </div>
      <p className="text-muted-foreground text-base">{t('game.alliance.transferHint')}</p>
      {send.error && (
        <p role="alert" className="text-danger">
          {errorText(send.error)}
        </p>
      )}
      <Button
        type="submit"
        className="self-start"
        disabled={!from || !to || !amount || send.isPending}
      >
        {t('game.alliance.transferSend')}
      </Button>
    </form>
  )
}

/** The private conversation of the alliance. */
function Chat({
  state,
  allianceId,
  name,
}: {
  state: MatchState
  allianceId: string
  name: string
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const matchId = state.match.id
  const [text, setText] = useState('')
  const key = ['matches', 'unit', matchId, 'alliance-chat', allianceId]
  // Under the `unit` key on purpose: it is read again whenever the match changes.
  const chat = useQuery({ queryKey: key, queryFn: () => matchApi.chat(matchId, allianceId) })
  const say = useMutation({
    mutationFn: () => matchApi.say(matchId, allianceId, text.trim()),
    onSuccess: (messages) => {
      queryClient.setQueryData(key, messages)
      setText('')
    },
  })
  const empires = new Map(state.empires.map((empire) => [empire.id, empire]))

  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-base">{t('game.alliance.chatWith', { name })}</h4>
      <ul className="flex max-h-64 flex-col-reverse overflow-y-auto rounded-md border px-3">
        {chat.data?.map((message) => (
          <li key={message.id} className="py-2">
            <span className="font-bold">{empires.get(message.empireId)?.name}</span>{' '}
            <span className="break-words">{message.text}</span>
          </li>
        ))}
        {chat.data?.length === 0 && (
          <li className="text-muted-foreground py-2">{t('game.alliance.chatEmpty')}</li>
        )}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (text.trim()) say.mutate()
        }}
      >
        <Input
          aria-label={t('game.alliance.chatWriteTo', { name })}
          placeholder={t('game.alliance.chatWrite')}
          maxLength={500}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <Button type="submit" size="sm" disabled={say.isPending || text.trim() === ''}>
          {t('game.alliance.chatSend')}
        </Button>
      </form>
    </div>
  )
}

/**
 * The player's alliances (PROMPT §2.6). Each is a pact with one empire, with
 * its own chat and its own end; being allied with the same empire does not
 * make two others allies.
 */
export function AlliancePage({ state }: { state: MatchState }) {
  const { t } = useTranslation()
  const errorText = useMatchErrorText()
  const queryClient = useQueryClient()
  const selectId = useId()
  const [target, setTarget] = useState('')
  const [ending, setEnding] = useState<string | null>(null)
  const [chatting, setChatting] = useState<string | null>(null)
  const matchId = state.match.id
  const mineId = state.me?.empireId ?? ''
  const empires = new Map(state.empires.map((empire) => [empire.id, empire]))

  const pacts = state.alliances
    .filter((pact) => pact.empireIds.includes(mineId))
    .map((pact) => ({ ...pact, allyId: pact.empireIds.find((id) => id !== mineId) ?? '' }))
  const allies = new Set(pacts.map((pact) => pact.allyId))
  const maxAllies = Number(state.match.config.allianceMaxAllies ?? 2)
  const hasRoom = pacts.length < maxAllies
  const candidates = state.empires.filter(
    (empire) => empire.id !== mineId && empire.status === 'ACTIVE' && !allies.has(empire.id),
  )
  const incoming = state.invites.filter((invite) => invite.toEmpireId === mineId)
  const outgoing = state.invites.filter((invite) => invite.fromEmpireId === mineId)

  const action = useMutation({
    mutationFn: (run: () => Promise<MatchState>) => run(),
    onSuccess: (next) => {
      queryClient.setQueryData(['matches', 'state', matchId], next)
      setEnding(null)
      setTarget('')
    },
  })
  const act: Act = (run) => action.mutate(run)

  return (
    <section className="flex flex-col gap-4" aria-labelledby="alliance-title">
      <h2 id="alliance-title" className="sr-only">
        {t('game.alliance.title')}
      </h2>
      <p className="text-muted-foreground text-base">
        {t('game.alliance.intro', { count: maxAllies })}
      </p>

      <div className="flex flex-col gap-2">
        <h3 className="text-base">{t('game.alliance.allies')}</h3>
        {pacts.length === 0 && <p>{t('game.alliance.none')}</p>}
        <ul className="flex flex-col gap-2">
          {pacts.map((pact) => {
            const empire = empires.get(pact.allyId)
            if (!empire) return null
            return (
              <li key={pact.id} className="flex flex-col gap-2 rounded-md border p-3">
                <div className="flex items-center gap-3">
                  <EmpireShield color={empire.color} emblem={empire.emblem} logo={empire.logoUrl} />
                  <span className="flex-1 font-bold">{empire.name}</span>
                </div>
                {pact.endsAtTurn !== null && (
                  <p role="status" className="text-danger text-base">
                    {pact.endedByEmpireId === mineId
                      ? t('game.alliance.endingByYou', { turn: pact.endsAtTurn })
                      : t('game.alliance.endingByThem', {
                          name: empire.name,
                          turn: pact.endsAtTurn,
                        })}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="quiet"
                    size="sm"
                    aria-expanded={chatting === pact.id}
                    onClick={() => setChatting(chatting === pact.id ? null : pact.id)}
                  >
                    {t('game.alliance.chat')}
                  </Button>
                  {pact.endsAtTurn === null ? (
                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={() => {
                        action.reset()
                        setEnding(pact.id)
                      }}
                    >
                      {t('game.alliance.end')}
                    </Button>
                  ) : (
                    pact.endedByEmpireId === mineId && (
                      <Button
                        size="sm"
                        disabled={action.isPending}
                        onClick={() => act(() => matchApi.keepAlliance(matchId, pact.id))}
                      >
                        {t('game.alliance.keep')}
                      </Button>
                    )
                  )}
                </div>
                {chatting === pact.id && (
                  <Chat state={state} allianceId={pact.id} name={empire.name} />
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {incoming.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-base">{t('game.alliance.incoming')}</h3>
          {incoming.map((invite) => (
            <div key={invite.id} className="flex flex-col gap-2 rounded-md border p-3">
              <p>
                {t('game.alliance.from', { name: empires.get(invite.fromEmpireId)?.name ?? '' })}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={action.isPending}
                  onClick={() => act(() => matchApi.answerInvite(matchId, invite.id, 'accept'))}
                >
                  {t('game.alliance.accept')}
                </Button>
                <Button
                  variant="quiet"
                  size="sm"
                  disabled={action.isPending}
                  onClick={() => act(() => matchApi.answerInvite(matchId, invite.id, 'decline'))}
                >
                  {t('game.alliance.decline')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-base">{t('game.alliance.outgoing')}</h3>
          {outgoing.map((invite) => (
            <div
              key={invite.id}
              className="flex items-center justify-between gap-2 rounded-md border p-3"
            >
              <p>
                {t('game.alliance.sentTo', { name: empires.get(invite.toEmpireId)?.name ?? '' })}
              </p>
              <Button
                variant="quiet"
                size="sm"
                disabled={action.isPending}
                onClick={() => act(() => matchApi.answerInvite(matchId, invite.id, 'withdraw'))}
              >
                {t('game.alliance.withdraw')}
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 pt-4">
        <h3 className="text-base">{t('game.alliance.propose')}</h3>
        {!hasRoom ? (
          <p className="text-muted-foreground">{t('game.alliance.full', { count: maxAllies })}</p>
        ) : candidates.length === 0 ? (
          <p className="text-muted-foreground">{t('game.alliance.noCandidates')}</p>
        ) : (
          <>
            <Label htmlFor={selectId}>{t('game.alliance.to')}</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger id={selectId} className="w-full">
                <SelectValue placeholder={t('game.alliance.choose')} />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((empire) => (
                  <SelectItem key={empire.id} value={empire.id}>
                    {empire.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="self-start"
              disabled={!target || action.isPending}
              onClick={() => act(() => matchApi.invite(matchId, target))}
            >
              {t('game.alliance.send')}
            </Button>
          </>
        )}
      </div>

      {action.error && ending === null && (
        <p role="alert" className="text-danger">
          {errorText(action.error)}
        </p>
      )}

      {allies.size > 0 && <Transfer state={state} allies={allies} />}

      <ConfirmDialog
        open={ending !== null}
        title={t('game.alliance.endTitle', {
          name: empires.get(pacts.find((pact) => pact.id === ending)?.allyId ?? '')?.name ?? '',
        })}
        description={t('game.alliance.endText')}
        confirmLabel={t('game.alliance.end')}
        pending={action.isPending}
        error={action.error ? errorText(action.error) : null}
        onConfirm={() => act(() => matchApi.endAlliance(matchId, ending ?? ''))}
        onClose={() => setEnding(null)}
      />
    </section>
  )
}
