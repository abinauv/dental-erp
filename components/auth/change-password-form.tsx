'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordRules } from '@/components/auth/password-rules'
import { authClient } from '@/lib/auth-client'
import { passwordProblems, type PasswordPolicy } from '@/lib/password-policy'

/**
 * Current password, new password and confirmation; changes it through Better
 * Auth (which checks the clinic's rules again) and signs out other devices.
 */
export function ChangePasswordForm({
  policy,
  onDone,
  submitLabel,
}: {
  policy: PasswordPolicy
  onDone?: () => void
  submitLabel?: string
}) {
  const t = useTranslations('auth.changePassword')
  const tRules = useTranslations('auth.passwordRules')
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (passwordProblems(next, policy).length) return setError(tRules('notAllowed'))
    if (next !== confirm) return setError(tRules('mismatch'))

    setSaving(true)
    try {
      const { error: failure } = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      })
      if (failure) {
        setError(
          failure.status === 429
            ? t('tooMany')
            : failure.code === 'INVALID_PASSWORD'
              ? t('wrongCurrent')
              : failure.code === 'PASSWORD_UNCHANGED'
                ? t('unchanged')
                : failure.code === 'PASSWORD_POLICY'
                  ? tRules('notAllowed')
                  : t('failed')
        )
        return
      }
      setCurrent('')
      setNext('')
      setConfirm('')
      onDone?.()
    } catch {
      setError(t('failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="current-password">{t('currentPassword')}</Label>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          disabled={saving}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-password">{t('newPassword')}</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          disabled={saving}
          aria-describedby="new-password-rules"
          required
        />
      </div>
      <PasswordRules id="new-password-rules" policy={policy} password={next} />
      <div className="space-y-2">
        <Label htmlFor="confirm-password">{t('confirmPassword')}</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={saving}
          required
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {saving ? t('saving') : (submitLabel ?? t('submit'))}
      </Button>
    </form>
  )
}
