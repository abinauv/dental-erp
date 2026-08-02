import { getRequestConfig } from 'next-intl/server'

import { auth } from '@/lib/auth'
import { getAuthenticatedPatient } from '@/lib/patient-auth'
import { prisma } from '@/lib/prisma'
import { defaultLocale, getLocaleDefaults, resolveLocaleCascade, type Locale } from './config'

/**
 * Locale resolution, most specific first.
 *
 * There is deliberately no `/[locale]/` URL segment — see docs/LOCALIZATION.md.
 * Three surfaces resolve differently because they authenticate differently:
 *
 *   Staff UI      User.locale    ?? Hospital.locale ?? default
 *   Patient portal Patient.locale ?? Hospital.locale ?? default
 *   Public pages  ?lang=         ?? Hospital.locale ?? default
 *
 * `null` on the person means "inherit from the clinic" — it is not a stored
 * preference. That is why these go through `resolveLocaleCascade` rather than
 * `resolveLocale(a ?? b)`: the latter would treat an unsupported stored value
 * as a decision and skip the clinic entirely.
 *
 * Anything that goes wrong here (no session, unreachable database, a locale
 * string that is no longer supported) falls back to the default rather than
 * throwing: a formatting concern must never be able to take a page down.
 */

/**
 * Staff locale, or `null` when there is no staff session.
 *
 * One query, not two. This runs on every server-rendered request, so the
 * clinic's locale is joined rather than fetched separately.
 */
async function resolveStaffLocale(): Promise<Locale | null> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return null

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { locale: true, hospital: { select: { locale: true } } },
  })
  if (!user) return null

  return resolveLocaleCascade(user.locale, user.hospital?.locale)
}

/**
 * Patient locale, or `null` when there is no patient session.
 *
 * The portal needs its own path: `auth()` is staff-only, and patients
 * authenticate through the OTP cookie in `lib/patient-auth.ts`. The extra
 * lookup is a primary-key read on a page render, which is worth paying to
 * reuse the token verification and the is-still-active check rather than
 * duplicating them here.
 */
async function resolvePatientLocale(): Promise<Locale | null> {
  const authenticated = await getAuthenticatedPatient()
  if (!authenticated) return null

  const patient = await prisma.patient.findUnique({
    where: { id: authenticated.id },
    select: { locale: true, hospital: { select: { locale: true } } },
  })
  if (!patient) return null

  return resolveLocaleCascade(patient.locale, patient.hospital?.locale)
}

/**
 * The locale for the current request, whoever is making it.
 *
 * Staff first, then patient — a browser can hold both cookies at once (a
 * receptionist checking the portal), and the staff session is the more
 * specific context in that case. Anonymous requests get the default; public
 * pages that know which clinic they belong to should call
 * `resolvePublicLocale` from ./config instead — it is pure, so importing it
 * does not drag next-auth into a page that has no session to read.
 */
export async function getLocaleForRequest(): Promise<Locale> {
  try {
    const staff = await resolveStaffLocale()
    if (staff) return staff

    const patient = await resolvePatientLocale()
    if (patient) return patient

    return defaultLocale
  } catch {
    return defaultLocale
  }
}

/**
 * Portal-only resolver, for code that already knows it is on a patient
 * surface and should not pay for an `auth()` call that cannot succeed.
 */
export async function getLocaleForPatientRequest(): Promise<Locale> {
  try {
    return (await resolvePatientLocale()) ?? defaultLocale
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
