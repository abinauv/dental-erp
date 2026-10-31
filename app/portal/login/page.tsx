'use client'

import { Suspense, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building2, Phone, Loader2, ArrowLeft, ShieldCheck } from 'lucide-react'

type Step = 'phone' | 'otp'

// useSearchParams() needs a Suspense boundary, otherwise this page cannot be
// prerendered. It used to inherit a dynamic parent layout, which masked this.
export default function PatientLoginPage() {
  return (
    <Suspense fallback={null}>
      <PatientLoginForm />
    </Suspense>
  )
}

function PatientLoginForm() {
  const t = useTranslations('portal.login')
  const router = useRouter()
  const searchParams = useSearchParams()
  const clinic = searchParams.get('clinic') || ''

  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [clinicSlug, setClinicSlug] = useState(clinic)
  const [clinicName, setClinicName] = useState('')

  const sendOTP = async () => {
    if (!phone || phone.length < 10) {
      setError(t('invalidPhone'))
      return
    }
    if (!clinicSlug) {
      setError(t('enterClinic'))
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/patient-portal/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, hospitalSlug: clinicSlug }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || t('sendFailed'))
        return
      }

      setStep('otp')
    } catch {
      setError(t('networkError'))
    } finally {
      setLoading(false)
    }
  }

  const verifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      setError(t('enterOtp'))
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/patient-portal/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp, hospitalSlug: clinicSlug }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || t('verifyFailed'))
        return
      }

      router.push('/portal')
    } catch {
      setError(t('networkError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl">{t('title')}</CardTitle>
          <CardDescription>
            {step === 'phone' ? t('subtitlePhone') : t('subtitleOtp')}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

          {step === 'phone' ? (
            <>
              {!clinic && (
                <div className="space-y-2">
                  <Label htmlFor="clinic">{t('clinicId')}</Label>
                  <Input
                    id="clinic"
                    placeholder={t('clinicPlaceholder')}
                    value={clinicSlug}
                    onChange={(e) => setClinicSlug(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{t('clinicHint')}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="phone">{t('phoneLabel')}</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder={t('phonePlaceholder')}
                    className="pl-10"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    maxLength={10}
                  />
                </div>
              </div>
              <Button className="w-full" onClick={sendOTP} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('sendOtp')}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="otp">{t('verificationCode')}</Label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    placeholder={t('otpPlaceholder')}
                    className="pl-10 text-center text-lg tracking-widest"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground">{t('sentTo', { phone })}</p>
              </div>
              <Button className="w-full" onClick={verifyOTP} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('verifyLogin')}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep('phone')
                  setOtp('')
                  setError('')
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('changePhone')}
              </Button>
            </>
          )}

          <p className="text-xs text-center text-muted-foreground pt-2">{t('securedBy')}</p>
        </CardContent>
      </Card>
    </div>
  )
}
