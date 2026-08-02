import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requirePatientAuth } from '@/lib/patient-auth'
import { isSupportedLocale, locales, resolveLocaleCascade, type Locale } from '@/lib/i18n/config'

/**
 * The signed-in patient's own portal preferences.
 *
 * Scoped to the patient in the OTP cookie, never to an id from the request —
 * the portal is the one place where an authenticated caller is not staff, and
 * a patient must not be able to read or write another patient's row.
 */

const profileUpdateSchema = z.object({
  // `null` or an empty string clears the override and inherits the clinic's
  // locale. See lib/i18n/config.ts for why that is not the same as picking
  // the clinic's current value.
  locale: z
    .union([z.string(), z.null()])
    .refine((value) => value === null || value === '' || isSupportedLocale(value), {
      message: 'Unsupported locale',
    })
    .transform((value) => (value === null || value === '' ? null : (value as Locale))),
})

export async function GET(req: NextRequest) {
  const { error, patient } = await requirePatientAuth(req)
  if (error) return error

  try {
    const record = await prisma.patient.findUnique({
      where: { id: patient!.id },
      select: {
        firstName: true,
        lastName: true,
        locale: true,
        hospital: { select: { locale: true } },
      },
    })

    if (!record) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    return NextResponse.json({
      firstName: record.firstName,
      lastName: record.lastName,
      locale: record.locale,
      hospitalLocale: record.hospital?.locale ?? null,
      effectiveLocale: resolveLocaleCascade(record.locale, record.hospital?.locale),
      supportedLocales: locales,
    })
  } catch (err: unknown) {
    console.error('Portal profile error:', err)
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const { error, patient } = await requirePatientAuth(req)
  if (error) return error

  let locale: Locale | null
  try {
    ;({ locale } = profileUpdateSchema.parse(await req.json()))
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid locale', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  try {
    const updated = await prisma.patient.update({
      where: { id: patient!.id },
      data: { locale },
      select: { locale: true, hospital: { select: { locale: true } } },
    })

    return NextResponse.json({
      locale: updated.locale,
      effectiveLocale: resolveLocaleCascade(updated.locale, updated.hospital?.locale),
      message: locale ? 'Language updated' : 'Language reset to the clinic default',
    })
  } catch (err: unknown) {
    console.error('Portal profile update error:', err)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
