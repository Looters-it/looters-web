import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarClock,
  Globe,
  Hourglass,
  Lock,
  Play,
  User,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSession } from '@/features/auth/session-context'
import { cn } from '@/lib/utils'

import { matchApi, type MatchOptions } from './api'
import { useMatchErrorText } from './errors'
import { emptyDraft, settingsFromDraft, type MatchDraft } from './match-draft'
import { MatchFields } from './MatchForm'

const STEPS = ['mode', 'pace', 'details'] as const
type Step = (typeof STEPS)[number]

/** A turn of a normal match, as it is typed: a number and its unit. */
const TURN_UNITS = { s: 1 / 3600, m: 1 / 60, h: 1 } as const
type TurnUnit = keyof typeof TURN_UNITS
/** The shortest turn, in seconds: a normal match may be as fast as a rush one. */
const MIN_TURN_SECONDS = 30

/**
 * One of the ways to play, to be picked among a few: a large picture (an icon
 * for now, an image later), then its name and what it means.
 */
function ChoiceCard(props: {
  icon: LucideIcon
  title: string
  text: string
  selected: boolean
  onSelect: () => void
}) {
  const Icon = props.icon
  return (
    <button
      type="button"
      role="radio"
      aria-checked={props.selected}
      onClick={props.onSelect}
      className={cn(
        'bg-card text-card-foreground flex cursor-pointer flex-col items-center gap-4 rounded-xl border-4 border-transparent p-6 text-center transition-[border-color,translate,box-shadow] duration-200 outline-none hover:-translate-y-1 hover:shadow-lg sm:p-8',
        'focus-visible:border-foreground',
        props.selected && 'border-secondary',
      )}
    >
      <span className="bg-background/60 flex size-32 items-center justify-center rounded-xl sm:size-40">
        <Icon aria-hidden="true" className="size-20 sm:size-24" strokeWidth={1.5} />
      </span>
      <b className="text-xl">{props.title}</b>
      <span className="text-muted-foreground text-base">{props.text}</span>
    </button>
  )
}

/** A choice between a few short answers, as buttons in a row. */
function Segmented<Value extends string>(props: {
  label: string
  value: Value
  options: { value: Value; label: string; icon: LucideIcon }[]
  onChange: (value: Value) => void
}) {
  const labelId = useId()
  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-base font-medium">
        {props.label}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {props.options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={option.value === props.value}
            onClick={() => props.onChange(option.value)}
            className={cn(
              'rounded-pill border-input focus-visible:border-foreground flex h-11 cursor-pointer items-center gap-2 border-2 px-5 text-base transition-colors outline-none',
              option.value === props.value &&
                'border-primary bg-primary text-primary-foreground font-bold',
            )}
          >
            <option.icon aria-hidden="true" className="size-4" />
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function NewMatchSteps({ options, onCreated }: { options: MatchOptions; onCreated: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const errorText = useMatchErrorText()
  const turnId = useId()
  const opponentsId = useId()
  const startId = useId()
  const [step, setStep] = useState<Step>('mode')
  const [draft, setDraft] = useState(() => emptyDraft(options.rules))
  const [turn, setTurn] = useState<{ amount: string; unit: TurnUnit }>({ amount: '24', unit: 'h' })
  const set = (changes: Partial<MatchDraft>) => setDraft((current) => ({ ...current, ...changes }))
  const single = draft.mode === 'SINGLEPLAYER'
  const rush = draft.pace === 'RUSH'

  const create = useMutation({
    mutationFn: () =>
      matchApi.create(
        settingsFromDraft({
          ...draft,
          turnHours: String((Number(turn.amount) || 0) * TURN_UNITS[turn.unit]),
        }),
      ),
    onSuccess: async (match) => {
      await queryClient.invalidateQueries({ queryKey: ['matches'] })
      onCreated()
      await navigate(`/match/${match.id}`)
    },
  })

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    create.mutate()
  }
  const position = STEPS.indexOf(step)
  const back = position > 0 && (
    <Button type="button" variant="quiet" onClick={() => setStep(STEPS[position - 1] ?? 'mode')}>
      {t('match.new.back')}
    </Button>
  )
  const heading = (title: string, children: ReactNode) => (
    <div className="flex flex-col gap-6">
      <h3 className="text-center text-2xl sm:text-3xl">{title}</h3>
      {children}
    </div>
  )

  return (
    <>
      <p className="text-muted-foreground text-center font-mono text-sm">
        {t('match.new.step', { step: position + 1, steps: STEPS.length })}
      </p>

      {step === 'mode' &&
        heading(
          t('match.new.modeTitle'),
          <div
            role="radiogroup"
            aria-label={t('match.new.modeTitle')}
            className="grid gap-5 sm:grid-cols-2"
          >
            <ChoiceCard
              icon={User}
              title={t('match.mode.SINGLEPLAYER')}
              text={t('match.new.singleText')}
              selected={single}
              onSelect={() => {
                set({ mode: 'SINGLEPLAYER' })
                setStep('pace')
              }}
            />
            <ChoiceCard
              icon={Users}
              title={t('match.mode.MULTIPLAYER')}
              text={t('match.new.multiText')}
              selected={!single}
              onSelect={() => {
                set({ mode: 'MULTIPLAYER' })
                setStep('pace')
              }}
            />
          </div>,
        )}

      {step === 'pace' &&
        heading(
          t('match.new.paceTitle'),
          <>
            <div
              role="radiogroup"
              aria-label={t('match.new.paceTitle')}
              className="grid gap-5 sm:grid-cols-2"
            >
              <ChoiceCard
                icon={Zap}
                title={t('match.pace.RUSH')}
                text={t('match.new.rushText')}
                selected={rush}
                onSelect={() => {
                  set({ pace: 'RUSH' })
                  setStep('details')
                }}
              />
              <ChoiceCard
                icon={Hourglass}
                title={t('match.pace.NORMAL')}
                text={t('match.new.normalText')}
                selected={!rush}
                onSelect={() => {
                  set({ pace: 'NORMAL' })
                  setStep('details')
                }}
              />
            </div>
            <div className="flex justify-start">{back}</div>
          </>,
        )}

      {step === 'details' &&
        heading(
          t('match.new.detailsTitle'),
          <form onSubmit={submit} className="mx-auto flex w-full max-w-xl flex-col gap-5">
            <p className="text-muted-foreground text-center">
              {t(`match.mode.${draft.mode}`)} · {t(`match.pace.${draft.pace}`)}
            </p>
            <MatchFields
              draft={draft}
              onChange={setDraft}
              maxPlayersLimit={options.maxPlayersLimit}
              omit={[
                'startAt',
                'turnHours',
                'inviteCode',
                ...(single ? (['maxPlayers', 'bots'] as const) : []),
              ]}
              extra={
                <>
                  {single && (
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={opponentsId}>{t('match.new.opponents')}</Label>
                      <Input
                        id={opponentsId}
                        type="number"
                        required
                        min={1}
                        max={20}
                        value={draft.opponents}
                        onChange={(event) => set({ opponents: event.target.value })}
                      />
                    </div>
                  )}

                  {rush ? (
                    <p className="text-muted-foreground">{t('match.new.rushTurn')}</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={turnId}>{t('match.new.turn')}</Label>
                      <Input
                        id={turnId}
                        type="number"
                        required
                        min={turn.unit === 's' ? MIN_TURN_SECONDS : turn.unit === 'm' ? 0.5 : 0.01}
                        step="any"
                        value={turn.amount}
                        onChange={(event) => setTurn({ ...turn, amount: event.target.value })}
                      />
                      <Select
                        value={turn.unit}
                        onValueChange={(unit) => setTurn({ ...turn, unit: unit as TurnUnit })}
                      >
                        <SelectTrigger aria-label={t('match.new.turnUnit')} className="mt-2 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(TURN_UNITS) as TurnUnit[]).map((unit) => (
                            <SelectItem key={unit} value={unit}>
                              {t(`match.new.units.${unit}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {!single && (
                    <Segmented
                      label={t('match.new.visibility')}
                      value={draft.visibility}
                      onChange={(visibility) => set({ visibility })}
                      options={[
                        { value: 'PUBLIC', label: t('match.visibility.PUBLIC'), icon: Globe },
                        { value: 'PRIVATE', label: t('match.visibility.PRIVATE'), icon: Lock },
                      ]}
                    />
                  )}
                  {!single && draft.visibility === 'PRIVATE' && (
                    <p className="text-muted-foreground text-base">{t('match.new.privateHint')}</p>
                  )}

                  <Segmented
                    label={t('match.new.start')}
                    value={draft.startNow ? 'now' : 'planned'}
                    onChange={(value) => set({ startNow: value === 'now' })}
                    options={[
                      { value: 'now', label: t('match.new.startNow'), icon: Play },
                      { value: 'planned', label: t('match.new.startPlanned'), icon: CalendarClock },
                    ]}
                  />
                  {draft.startNow ? (
                    <p className="text-muted-foreground text-base">{t('match.new.startNowHint')}</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={startId}>{t('match.form.startAt')}</Label>
                      <Input
                        id={startId}
                        type="datetime-local"
                        required
                        value={draft.startAt}
                        onChange={(event) => set({ startAt: event.target.value })}
                      />
                      <p className="text-muted-foreground text-base">
                        {t('match.new.startPlannedHint')}
                      </p>
                    </div>
                  )}
                </>
              }
            />
            {create.error && (
              <p role="alert" className="text-danger">
                {errorText(create.error)}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {back}
              <Button type="submit" size="lg" disabled={create.isPending || !draft.areaId}>
                {t('match.new.create')}
              </Button>
            </div>
          </form>,
        )}
    </>
  )
}

/**
 * Creating a match: a large dialog in the middle of the screen that asks, one
 * thing at a time, how to play (alone or with others), at what pace (rush or
 * normal) and then the rest.
 */
export function NewMatchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const { user } = useSession()
  const options = useQuery({
    queryKey: ['matches', 'options'],
    queryFn: matchApi.options,
    enabled: open,
  })

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-6 overflow-y-auto p-6 sm:max-w-4xl sm:p-10">
        <DialogTitle className="text-center text-3xl sm:text-4xl">
          {t('match.new.title')}
        </DialogTitle>
        <DialogDescription className="sr-only">{t('match.new.intro')}</DialogDescription>
        {user === null ? (
          <div className="flex flex-col items-center gap-4">
            <p className="text-muted-foreground">{t('match.new.guest')}</p>
            <Button asChild>
              <Link to="/auth/login?next=%2Fmatch%2Fnew">{t('auth.login.submit')}</Link>
            </Button>
          </div>
        ) : (
          options.data && user && <NewMatchSteps options={options.data} onCreated={onClose} />
        )}
      </DialogContent>
    </Dialog>
  )
}
