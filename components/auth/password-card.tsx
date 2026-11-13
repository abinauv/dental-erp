'use client'

import { useTranslations } from 'next-intl'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChangePasswordForm } from '@/components/auth/change-password-form'
import { useToast } from '@/hooks/use-toast'
import type { PasswordPolicy } from '@/lib/password-policy'

/** Settings → Profile: change the password you sign in with. */
export function PasswordCard({ policy }: { policy: PasswordPolicy }) {
  const t = useTranslations('settings.profile')
  const tChange = useTranslations('auth.changePassword')
  const { toast } = useToast()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('passwordTitle')}</CardTitle>
        <CardDescription>{t('passwordDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChangePasswordForm
          policy={policy}
          onDone={() => toast({ title: tChange('done'), description: tChange('doneBody') })}
        />
      </CardContent>
    </Card>
  )
}
