import { getRequestConfig } from 'next-intl/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defaultLocale, getLocaleDefaults, resolveLocale, type Locale } from './config'

/**
 * Resolve the active locale from the signed-in user's clinic.
 *
 * There is deliberately no `/[locale]/` URL segment — see docs/LOCALIZATION.md.
 * Anything that goes wrong here (no session, unreachable database, a locale
 * string that is no longer supported) falls back to the default rather than
 * throwing: a formatting concern must never be able to take a page down.
 */
export async function getLocaleForRequest(): Promise<Locale> {
  try {
    const session = await auth()
    const hospitalId = session?.user?.hospitalId
    if (!hospitalId) return defaultLocale

    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { locale: true },
    })

    return resolveLocale(hospital?.locale)
  } catch {
    return defaultLocale
  }
}

async function loadMessages(locale: Locale) {
  return (await import(`../../messages/${locale}.json`)).default
}

export default getRequestConfig(async () => {
  const locale = await getLocaleForRequest()
  const { timezone } = getLocaleDefaults(locale)

  return {
    locale,
    timeZone: timezone,
    messages: await loadMessages(locale),
  }
})
