import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { LanguagePreferenceCard } from '@/components/i18n/language-preference-card'
import { auth } from '@/lib/auth'
import { locales } from '@/lib/i18n/config'
import { prisma } from '@/lib/prisma'

export async function generateMetadata() {
  const t = await getTranslations('settings.profile')
  return { title: t('title') }
}

export default async function ProfileSettingsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  const t = await getTranslations('settings.profile')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      locale: true,
      hospital: { select: { locale: true, currency: true } },
    },
  })

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('subtitle', { name: user.name ?? '', email: user.email ?? '' })}
        </p>
      </div>

      <LanguagePreferenceCard
        locale={user.locale}
        hospitalLocale={user.hospital?.locale ?? null}
        currency={user.hospital?.currency ?? 'INR'}
        supportedLocales={locales}
        endpoint="/api/settings/profile"
      />
    </div>
  )
}
