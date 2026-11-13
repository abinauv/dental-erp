'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CheckCircle2, KeyRound, Loader2, XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PasswordRules } from '@/components/auth/password-rules'
import { authClient } from '@/lib/auth-client'
import { passwordProblems } from '@/lib/password-policy'
import { usePasswordPolicy } from '@/hooks/use-password-policy'

function StatusCard({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ReactNode
  title: string
  body?: string
  children?: React.ReactNode
}) {
  return (
    <Card className="shadow-lg">
      <CardHeader className="space-y-1 text-center">
        <div className="mb-4 flex justify-center">{icon}</div>
        <CardTitle className="text-2xl font-bold">{title}</CardTitle>
        {body && <CardDescription>{body}</CardDescription>}
      </CardHeader>
      {children && <CardContent>{children}</CardContent>}
    </Card>
  )
}

// Better Auth's emailed link (/api/auth/reset-password/<token>) checks the
// token and lands here with ?token=…, or with ?error=INVALID_TOKEN.
function ResetPasswordContent() {
  const t = useTranslations('auth.reset')
  const tRules = useTranslations('auth.passwordRules')
  const params = useSearchParams()
  const token = params.get('error') ? null : params.get('token')
  const policyState = usePasswordPolicy(token ?? '')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [expired, setExpired] = useState(false)

  if (done) {
    return (
      <StatusCard
        icon={
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
        }
        title={t('doneTitle')}
        body={t('doneBody')}
      >
        <Button asChild className="w-full">
          <Link href="/login">{t('signIn')}</Link>
        </Button>
      </StatusCard>
    )
  }

  if (!token || expired || policyState.status === 'invalid') {
    return (
      <StatusCard
        icon={
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <XCircle className="h-6 w-6 text-red-600" />
          </div>
        }
        title={t('invalidTitle')}
        body={t('invalidBody')}
      >
        <Button asChild className="w-full">
          <Link href="/forgot-password">{t('requestNew')}</Link>
        </Button>
      </StatusCard>
    )
  }

  if (policyState.status === 'loading') {
    return (
      <StatusCard
        icon={
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        }
        title={t('loading')}
      />
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (passwordProblems(next, policyState.policy).length) return setError(tRules('notAllowed'))
    if (next !== confirm) return setError(tRules('mismatch'))

    setSaving(true)
    try {
      const { error: failure } = await authClient.resetPassword({ newPassword: next, token })
      if (failure) {
        if (failure.code === 'INVALID_TOKEN') setExpired(true)
        else
          setError(
            failure.status === 429
              ? t('tooMany')
              : failure.code === 'PASSWORD_POLICY'
                ? tRules('notAllowed')
                : t('failed')
          )
        return
      }
      setDone(true)
    } catch {
      setError(t('failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <StatusCard
      icon={
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <KeyRound className="h-6 w-6" />
        </div>
      }
      title={t('heading')}
      body={t('subheading')}
    >
      <form onSubmit={submit} className="space-y-4">
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
        <PasswordRules id="new-password-rules" policy={policyState.policy} password={next} />
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
          {saving ? t('saving') : t('submit')}
        </Button>
      </form>
    </StatusCard>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  )
}
