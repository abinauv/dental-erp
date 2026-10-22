import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { LanguagePreferenceCard } from '@/components/i18n/language-preference-card'
import { locales } from '@/lib/i18n/config'
import { getAuthenticatedPatient } from '@/lib/patient-auth'
import { prisma } from '@/lib/prisma'

export async function generateMetadata() {
  const t = await getTranslations('portal.profile')
  return { title: t('title') }
}

export default async function PortalProfilePage() {
  const t = await getTranslations('portal.profile')
  const authenticated = await getAuthenticatedPatient()
  if (!authenticated) {
    redirect('/portal/login')
  }

  const patient = await prisma.patient.findUnique({
    where: { id: authenticated.id },
    select: {
      locale: true,
      hospital: { select: { locale: true, currency: true } },
    },
  })

  if (!patient) {
    redirect('/portal/login')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <LanguagePreferenceCard
        locale={patient.locale}
        hospitalLocale={patient.hospital?.locale ?? null}
        currency={patient.hospital?.currency ?? 'INR'}
        supportedLocales={locales}
        endpoint="/api/patient-portal/profile"
        description={t('description')}
      />
    </div>
  )
}
