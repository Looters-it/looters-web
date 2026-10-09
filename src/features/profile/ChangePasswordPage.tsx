import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { changePassword } from '@/features/auth/api'
import { ApiError } from '@/lib/api'

import { ProfileFrame } from './ProfileFrame'

const PASSWORD_MIN = 8
type Problem = 'required' | 'password' | 'tooLong' | 'same' | 'mismatch'
const FIELDS = ['currentPassword', 'newPassword', 'repeat'] as const
type FieldName = (typeof FIELDS)[number]

// The same rules the api applies, checked here first; the api still decides.
const schema = z
  .object({
    currentPassword: z.string().min(1, 'required').max(200, 'tooLong'),
    newPassword: z.string().min(1, 'required').min(PASSWORD_MIN, 'password').max(200, 'tooLong'),
    repeat: z.string().min(1, 'required'),
  })
  .superRefine((values, context) => {
    if (values.newPassword && values.newPassword === values.currentPassword) {
      context.addIssue({ code: 'custom', path: ['newPassword'], message: 'same' })
    }
    if (values.repeat && values.repeat !== values.newPassword) {
      context.addIssue({ code: 'custom', path: ['repeat'], message: 'mismatch' })
    }
  })

const KNOWN = ['WRONG_PASSWORD', 'RATE_LIMITED', 'VALIDATION'] as const

/** `/profile/change-password`: the password in use, then the new one twice. */
export function ChangePasswordPage() {
  const { t } = useTranslation()
  const id = useId()
  const [problems, setProblems] = useState<Partial<Record<FieldName, Problem>>>({})
  const [error, setError] = useState<(typeof KNOWN)[number] | 'UNKNOWN' | null>(null)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const parsed = schema.safeParse(Object.fromEntries(new FormData(form)))
    setError(null)
    setDone(false)
    if (!parsed.success) {
      const found: Partial<Record<FieldName, Problem>> = {}
      for (const issue of parsed.error.issues) {
        found[issue.path[0] as FieldName] ??= issue.message as Problem
      }
      setProblems(found)
      const first = FIELDS.find((name) => found[name])
      const input = first ? form.elements.namedItem(first) : null
      if (input instanceof HTMLElement) input.focus()
      return
    }
    setProblems({})
    setPending(true)
    changePassword({
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
    })
      .then(() => {
        form.reset()
        setDone(true)
      })
      .catch((reason: unknown) => {
        const code = reason instanceof ApiError ? reason.code : null
        setError(KNOWN.find((known) => known === code) ?? 'UNKNOWN')
      })
      .finally(() => setPending(false))
  }

  const field = (name: FieldName, autoComplete: string, hint?: string) => {
    const problem = problems[name]
    return (
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-${name}`}>{t(`profile.password.${name}`)}</Label>
        <Input
          id={`${id}-${name}`}
          name={name}
          type="password"
          autoComplete={autoComplete}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? `${id}-${name}-problem` : undefined}
        />
        {problem ? (
          <p id={`${id}-${name}-problem`} className="text-danger text-base">
            {t(`profile.password.invalid.${problem}`, { min: PASSWORD_MIN })}
          </p>
        ) : (
          hint && <p className="text-muted-foreground text-sm">{hint}</p>
        )}
      </div>
    )
  }

  return (
    <ProfileFrame title={t('profile.password.title')} back>
      {(user) => (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {/* Not shown, and not sent: it tells the browser whose password this is, so that
              the one it has saved for this player is the one it updates. */}
          <input
            type="text"
            name="username"
            autoComplete="username"
            value={user.username}
            readOnly
            hidden
          />
          {field('currentPassword', 'current-password')}
          {field('newPassword', 'new-password', t('auth.passwordHint', { min: PASSWORD_MIN }))}
          {field('repeat', 'new-password')}
          {error && (
            <p role="alert" className="text-danger">
              {t(`profile.password.errors.${error}`)}
            </p>
          )}
          {done && (
            <p role="status" className="text-ok">
              {t('profile.password.done')}
            </p>
          )}
          <Button type="submit" className="min-h-11 w-full text-[17px]" disabled={pending}>
            {t('profile.password.submit')}
          </Button>
        </form>
      )}
    </ProfileFrame>
  )
}
