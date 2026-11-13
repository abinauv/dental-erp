'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { KeyRound, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChangePasswordForm } from '@/components/auth/change-password-form'
import { useToast } from '@/hooks/use-toast'
import { usePasswordPolicy } from '@/hooks/use-password-policy'
import { signOut } from '@/lib/auth-client'

// Where a person whose password was set by an admin or an import is sent
// (app/(dashboard)/layout.tsx) until they choose their own. Anyone signed in
// can also change their password here.
export default function ChangePasswordPage() {
  const t = useTranslations('auth.changePassword')
  const router = useRouter()
  const { toast } = useToast()
  const { status, policy, mustChangePassword } = usePasswordPolicy()

  const done = () => {
    toast({ title: t('done'), description: t('doneBody') })
    router.push('/dashboard')
    router.refresh()
  }

  const leave = async () => {
    if (mustChangePassword) {
      await signOut()
      router.push('/login')
    } else {
      router.back()
    }
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="space-y-1 text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <KeyRound className="h-6 w-6" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">
          {mustChangePassword ? t('requiredHeading') : t('heading')}
        </CardTitle>
        <CardDescription>
          {mustChangePassword ? t('requiredBody') : t('subheading')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status === 'loading' ? (
          <div className="flex justify-center py-6" aria-label={t('loading')}>
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <ChangePasswordForm policy={policy} onDone={done} />
            <Button type="button" variant="ghost" className="mt-2 w-full" onClick={leave}>
              {mustChangePassword ? t('signOut') : t('back')}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
