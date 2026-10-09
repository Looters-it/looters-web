import { LoaderCircle } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'

import { usernameAvailable } from './api'
import { useSession } from './session-context'

const PASSWORD_MIN = 8
const USERNAME = /^[A-Za-z0-9_]{3,20}$/
/** How long after the last key the username is looked up. */
const CHECK_DELAY_MS = 1500

/** What makes a field wrong, as the key of the sentence that says so. */
type Problem = 'required' | 'username' | 'email' | 'password' | 'tooLong'

// The same rules the api applies, checked here first with the same library: a mistake
// is said next to its field, without a round trip. The api still decides.
const loginSchema = z.object({
  username: z.string().trim().min(1, 'required').max(100, 'tooLong'),
  password: z.string().min(1, 'required').max(200, 'tooLong'),
})
const registerSchema = z.object({
  username: z.string().trim().min(1, 'required').regex(USERNAME, 'username'),
  email: z.string().trim().min(1, 'required').max(254, 'tooLong').pipe(z.email('email')),
  password: z.string().min(1, 'required').min(PASSWORD_MIN, 'password').max(200, 'tooLong'),
  /**
   * The honeypot: a field no person sees or fills. A programme that fills
   * every field it finds gives itself away, here and again on the server.
   */
  contactTime: z.string().max(200).default(''),
})

const KNOWN_ERRORS = [
  'INVALID_CREDENTIALS',
  'USERNAME_TAKEN',
  'RATE_LIMITED',
  'VALIDATION',
] as const
type KnownError = (typeof KNOWN_ERRORS)[number]

function errorKey(error: unknown): KnownError | 'UNKNOWN' {
  const code = error instanceof ApiError ? error.code : null
  return KNOWN_ERRORS.find((known) => known === code) ?? 'UNKNOWN'
}

function Field(props: {
  label: string
  hint?: string
  name: string
  type?: string
  autoComplete: string
  maxLength?: number
  problem?: Problem
}) {
  const { t } = useTranslation()
  const id = useId()
  const { label, hint, problem, ...input } = props
  const described = [hint && `${id}-hint`, problem && `${id}-problem`].filter(Boolean).join(' ')
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={problem ? true : undefined}
        aria-describedby={described || undefined}
        {...input}
      />
      {problem ? (
        <p id={`${id}-problem`} className="text-danger text-base">
          {t(`auth.invalid.${problem}`, { min: PASSWORD_MIN })}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-muted-foreground text-sm">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'failed'

/**
 * The username of a registration, looked up while it is typed: once the typing
 * has stopped for a moment and the name could be one, the server is asked whether
 * it is free. A wheel turns in the field meanwhile; the answer is written under it
 * and colours its border, green for free and red for taken.
 */
function UsernameField(props: { problem?: Problem }) {
  const { t } = useTranslation()
  const id = useId()
  const [value, setValue] = useState('')
  const [state, setState] = useState<Availability>('idle')
  const name = value.trim()

  useEffect(() => {
    if (!USERNAME.test(name)) return
    const asking = new AbortController()
    const timer = setTimeout(() => {
      setState('checking')
      usernameAvailable(name, asking.signal)
        .then(({ available }) => setState(available ? 'available' : 'taken'))
        .catch(() => {
          if (!asking.signal.aborted) setState('failed')
        })
    }, CHECK_DELAY_MS)
    return () => {
      clearTimeout(timer)
      asking.abort()
    }
  }, [name])

  // What the form found wrong on sending comes before what the lookup says.
  const { problem } = props
  const answered = !problem && state !== 'idle'
  const below = problem ? 'problem' : answered ? 'state' : 'hint'
  return (
    <div className="relative flex flex-col gap-1">
      <Label htmlFor={id}>{t('auth.username')}</Label>
      <Input
        id={id}
        name="username"
        autoComplete="username"
        maxLength={20}
        value={value}
        onChange={(event) => {
          setValue(event.target.value)
          setState('idle')
        }}
        aria-invalid={problem || state === 'taken' ? true : undefined}
        aria-describedby={`${id}-${below}`}
        className={cn(
          state === 'checking' && 'pr-12',
          !problem && state === 'available' && 'border-ok focus-visible:border-ok',
        )}
      />
      {state === 'checking' && (
        // In the middle of the field's height, whatever stands above it.
        <LoaderCircle
          aria-hidden="true"
          className="text-muted-foreground absolute top-[19px] right-4 size-5 animate-spin"
        />
      )}
      {problem && (
        <p id={`${id}-problem`} className="text-danger text-base">
          {t(`auth.invalid.${problem}`, { min: PASSWORD_MIN })}
        </p>
      )}
      {/* Always there, so that the answer is announced when it comes. */}
      <p
        id={`${id}-state`}
        role="status"
        className={cn(
          'text-base',
          !answered && 'sr-only',
          state === 'available' && 'text-ok',
          state === 'taken' && 'text-danger',
          (state === 'checking' || state === 'failed') && 'text-muted-foreground',
        )}
      >
        {answered && t(`auth.availability.${state}`, { name })}
      </p>
      {below === 'hint' && (
        <p id={`${id}-hint`} className="text-muted-foreground text-sm">
          {t('auth.usernameHint')}
        </p>
      )}
    </div>
  )
}

function AuthForm<Values>(props: {
  schema: z.ZodType<Values>
  submitLabel: string
  onSubmit: (values: Values) => Promise<void>
  onSuccess?: () => void
  children: (problems: Record<string, Problem | undefined>) => ReactNode
}) {
  const { t } = useTranslation()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<KnownError | 'UNKNOWN' | null>(null)
  const [problems, setProblems] = useState<Record<string, Problem | undefined>>({})

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = props.schema.safeParse(Object.fromEntries(new FormData(event.currentTarget)))
    setError(null)
    if (!parsed.success) {
      // The first thing wrong with each field.
      const found: Record<string, Problem> = {}
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0])
        found[field] ??= issue.message as Problem
      }
      setProblems(found)
      // The first field that is wrong takes the focus, so that it can be put right at once.
      const first = Object.keys(found)[0]
      const input = first ? event.currentTarget.elements.namedItem(first) : null
      if (input instanceof HTMLElement) input.focus()
      return
    }
    setProblems({})
    setPending(true)
    props
      .onSubmit(parsed.data)
      .then(() => props.onSuccess?.())
      .catch((reason: unknown) => setError(errorKey(reason)))
      .finally(() => setPending(false))
  }

  return (
    // Checked by the schema above, not by the browser: one voice for every mistake.
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {props.children(problems)}
      {error && (
        <p role="alert" className="text-danger">
          {t(`auth.errors.${error}`)}
        </p>
      )}
      {/* As wide and as tall as the fields above it: one column of the same shape. */}
      <Button type="submit" className="min-h-11 w-full text-[17px]" disabled={pending}>
        {props.submitLabel}
      </Button>
    </form>
  )
}

export function LoginForm({ onSuccess }: { onSuccess?: () => void }) {
  const { t } = useTranslation()
  const { login } = useSession()
  return (
    <AuthForm
      schema={loginSchema}
      submitLabel={t('auth.login.submit')}
      onSuccess={onSuccess}
      onSubmit={(values) => login(values)}
    >
      {(problems) => (
        <>
          <Field
            label={t('auth.username')}
            name="username"
            autoComplete="username"
            maxLength={100}
            problem={problems.username}
          />
          <Field
            label={t('auth.password')}
            name="password"
            type="password"
            autoComplete="current-password"
            problem={problems.password}
          />
        </>
      )}
    </AuthForm>
  )
}

export function RegisterForm({ onSuccess }: { onSuccess?: () => void }) {
  const { t } = useTranslation()
  const { register } = useSession()
  return (
    <AuthForm
      schema={registerSchema}
      submitLabel={t('auth.register.submit')}
      onSuccess={onSuccess}
      onSubmit={(values) => register(values)}
    >
      {(problems) => (
        <>
          <UsernameField problem={problems.username} />
          <Field
            label={t('auth.email')}
            name="email"
            type="email"
            autoComplete="email"
            problem={problems.email}
          />
          <Field
            label={t('auth.password')}
            hint={t('auth.passwordHint', { min: PASSWORD_MIN })}
            name="password"
            type="password"
            autoComplete="new-password"
            problem={problems.password}
          />
          {/* The honeypot. Out of sight, out of the tab order and out of the reach of
              screen readers and of autofill: only a programme finds it. */}
          <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
            <label>
              Leave this field empty
              <input type="text" name="contactTime" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
        </>
      )}
    </AuthForm>
  )
}
