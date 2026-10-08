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
    <form onSubmit={submit} className="flex flex-col gap-3 border-t pt-4">
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
function Chat({ state }: { state: MatchState }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const matchId = state.match.id
  const [text, setText] = useState('')
  const key = ['matches', 'unit', matchId, 'alliance-chat']
  // Under the `unit` key on purpose: it is read again whenever the match changes.
  const chat = useQuery({ queryKey: key, queryFn: () => matchApi.chat(matchId) })
  const say = useMutation({
    mutationFn: () => matchApi.say(matchId, text.trim()),
    onSuccess: (messages) => {
      queryClient.setQueryData(key, messages)
      setText('')
    },
  })
  const empires = new Map(state.empires.map((empire) => [empire.id, empire]))

  return (
    <div className="flex flex-col gap-2 border-t pt-4">
      <h3 className="text-base">{t('game.alliance.chat')}</h3>
      <ul className="flex max-h-64 flex-col-reverse overflow-y-auto rounded-md border px-3">
        {chat.data?.map((message) => (
          <li key={message.id} className="border-t py-2 first:border-t-0">
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
          aria-label={t('game.alliance.chatWrite')}
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
 * The player's alliance (PROMPT §2.6): members, proposals made and received,
 * the exit with its notice, transfers to allies and the private chat.
 */
export function AlliancePage({ state }: { state: MatchState }) {
  const { t } = useTranslation()
  const errorText = useMatchErrorText()
  const queryClient = useQueryClient()
  const selectId = useId()
  const [target, setTarget] = useState('')
  const [confirmLeave, setConfirmLeave] = useState(false)
  const matchId = state.match.id
  const mineId = state.me?.empireId ?? ''
  const empires = new Map(state.empires.map((empire) => [empire.id, empire]))

  const alliance = state.alliances.find((a) => a.members.some((m) => m.empireId === mineId))
  const me = alliance?.members.find((member) => member.empireId === mineId)
  const allies = new Set(
    alliance?.members.map((m) => m.empireId).filter((id) => id !== mineId) ?? [],
  )
  const allied = new Set(state.alliances.flatMap((a) => a.members.map((m) => m.empireId)))
  const maxMembers = Number(state.match.config.allianceMaxMembers ?? 3)
  const hasRoom = !alliance || alliance.members.length < maxMembers
  const candidates = state.empires.filter(
    (empire) => empire.id !== mineId && empire.status === 'ACTIVE' && !allied.has(empire.id),
  )
  const incoming = state.invites.filter((invite) => invite.toEmpireId === mineId)
  const outgoing = state.invites.filter((invite) => invite.fromEmpireId === mineId)

  const action = useMutation({
    mutationFn: (run: () => Promise<MatchState>) => run(),
    onSuccess: (next) => {
      queryClient.setQueryData(['matches', 'state', matchId], next)
      setConfirmLeave(false)
      setTarget('')
    },
  })
  const act: Act = (run) => action.mutate(run)

  return (
    <section className="flex flex-col gap-4" aria-labelledby="alliance-title">
      <h2 id="alliance-title" className="text-lg">
        {t('game.alliance.title')}
      </h2>
      <p className="text-muted-foreground text-base">
        {t('game.alliance.intro', { max: maxMembers })}
      </p>

      {alliance ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-base">{t('game.alliance.members')}</h3>
          <ul className="flex flex-col gap-2">
            {alliance.members.map((member) => {
              const empire = empires.get(member.empireId)
              return (
                empire && (
                  <li key={member.empireId} className="flex items-center gap-3">
                    <EmpireShield color={empire.color} emblem={empire.emblem} />
                    <span className="flex-1 font-bold">
                      {empire.name}
                      {member.empireId === mineId && (
                        <span className="text-muted-foreground font-normal">
                          {' '}
                          ({t('game.alliance.you')})
                        </span>
                      )}
                    </span>
                    {member.leavesAtTurn !== null && (
                      <span className="text-danger text-base">
                        {t('game.alliance.leaving', { turn: member.leavesAtTurn })}
                      </span>
                    )}
                  </li>
                )
              )
            })}
          </ul>
        </div>
      ) : (
        <p>{t('game.alliance.none')}</p>
      )}

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

      {me?.leavesAtTurn != null ? (
        <p role="status" className="text-danger">
          {t('game.alliance.leavingYou', { turn: me.leavesAtTurn })}
        </p>
      ) : (
        hasRoom && (
          <div className="flex flex-col gap-2 border-t pt-4">
            <h3 className="text-base">
              {alliance ? t('game.alliance.invite') : t('game.alliance.propose')}
            </h3>
            {candidates.length === 0 ? (
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
        )
      )}

      {action.error && (
        <p role="alert" className="text-danger">
          {errorText(action.error)}
        </p>
      )}

      {alliance && allies.size > 0 && <Transfer state={state} allies={allies} />}
      {alliance && <Chat state={state} />}

      {alliance && me?.leavesAtTurn == null && (
        <Button
          variant="quiet"
          size="sm"
          className="self-start"
          onClick={() => {
            action.reset()
            setConfirmLeave(true)
          }}
        >
          {t('game.alliance.leave')}
        </Button>
      )}
      <ConfirmDialog
        open={confirmLeave}
        title={t('game.alliance.leaveTitle')}
        description={t('game.alliance.leaveText')}
        confirmLabel={t('game.alliance.leave')}
        pending={action.isPending}
        error={action.error ? errorText(action.error) : null}
        onConfirm={() => act(() => matchApi.leaveAlliance(matchId))}
        onClose={() => setConfirmLeave(false)}
      />
    </section>
  )
}
