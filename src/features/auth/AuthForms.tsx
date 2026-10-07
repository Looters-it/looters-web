import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api'

import { useSession } from './session-context'

// Mirrors the api's rules so most mistakes are caught before the request.
const USERNAME_PATTERN = '[A-Za-z0-9_]{3,20}'
const PASSWORD_MIN = 8

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
  pattern?: string
  minLength?: number
  maxLength?: number
}) {
  const id = useId()
  const { label, hint, ...input } = props
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} required aria-describedby={hint ? `${id}-hint` : undefined} {...input} />
      {hint && (
        <p id={`${id}-hint`} className="text-muted-foreground text-sm">
          {hint}
        </p>
      )}
    </div>
  )
}

function AuthForm(props: {
  submitLabel: string
  onSubmit: (values: Record<string, string>) => Promise<void>
  onSuccess?: () => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<KnownError | 'UNKNOWN' | null>(null)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>
    setPending(true)
    setError(null)
    props
      .onSubmit(values)
      .then(() => props.onSuccess?.())
      .catch((reason: unknown) => setError(errorKey(reason)))
      .finally(() => setPending(false))
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {props.children}
      {error && (
        <p role="alert" className="text-danger">
          {t(`auth.errors.${error}`)}
        </p>
      )}
      <Button type="submit" disabled={pending}>
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
      submitLabel={t('auth.login.submit')}
      onSuccess={onSuccess}
      onSubmit={({ username, password }) => login({ username, password })}
    >
      <Field label={t('auth.username')} name="username" autoComplete="username" maxLength={20} />
      <Field
        label={t('auth.password')}
        name="password"
        type="password"
        autoComplete="current-password"
      />
    </AuthForm>
  )
}

export function RegisterForm({ onSuccess }: { onSuccess?: () => void }) {
  const { t } = useTranslation()
  const { register } = useSession()
  return (
    <AuthForm
      submitLabel={t('auth.register.submit')}
      onSuccess={onSuccess}
      onSubmit={({ username, email, password }) => register({ username, email, password })}
    >
      <Field
        label={t('auth.username')}
        hint={t('auth.usernameHint')}
        name="username"
        autoComplete="username"
        pattern={USERNAME_PATTERN}
        maxLength={20}
      />
      <Field label={t('auth.email')} name="email" type="email" autoComplete="email" />
      <Field
        label={t('auth.password')}
        hint={t('auth.passwordHint', { min: PASSWORD_MIN })}
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN}
      />
    </AuthForm>
  )
}
