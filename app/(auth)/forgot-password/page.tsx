'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { KeyRound, Loader2, MailCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { authClient } from '@/lib/auth-client'

// Same shape check as the login form.
const EMAIL = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/

export default function ForgotPasswordPage() {
  const t = useTranslations('auth.forgot')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const address = email.trim()
    if (!EMAIL.test(address)) return setError(t('vEmail'))

    setSending(true)
    try {
      // The answer is the same whether or not the email has an account.
      const { error: failure } = await authClient.requestPasswordReset({
        email: address,
        redirectTo: '/reset-password',
      })
      if (failure) {
        setError(failure.status === 429 ? t('tooMany') : t('failed'))
        return
      }
      setSentTo(address)
    } catch {
      setError(t('failed'))
    } finally {
      setSending(false)
    }
  }

  if (sentTo) {
    return (
      <Card className="shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <MailCheck className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">{t('sentTitle')}</CardTitle>
          <CardDescription>{t('sentBody', { email: sentTo })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('noEmailHint')}</p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">{t('backToLogin')}</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="space-y-1 text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <KeyRound className="h-6 w-6" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">{t('heading')}</CardTitle>
        <CardDescription>{t('subheading')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={sending}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={sending}>
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {sending ? t('sending') : t('submit')}
          </Button>
        </form>
        <div className="mt-6 text-center text-sm">
          <Link href="/login" className="text-primary hover:underline">
            {t('backToLogin')}
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
