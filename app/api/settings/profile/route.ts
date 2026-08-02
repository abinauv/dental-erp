import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { isSupportedLocale, locales, resolveLocaleCascade, type Locale } from '@/lib/i18n/config'

/**
 * The signed-in staff member's own profile preferences.
 *
 * Deliberately not role-gated beyond being authenticated: this only ever reads
 * and writes the caller's own row, keyed on the session user id. Nothing here
 * takes a user id from the request body.
 */

const profileUpdateSchema = z.object({
  // `null` (or an empty string from a <select>) clears the override and puts
  // the user back on the clinic's locale. It is not the same as choosing the
  // clinic's current value, which would stick if the clinic later changed.
  locale: z
    .union([z.string(), z.null()])
    .refine((value) => value === null || value === '' || isSupportedLocale(value), {
      message: 'Unsupported locale',
    })
    .transform((value) => (value === null || value === '' ? null : (value as Locale))),
})

export async function GET() {
  const { error, user } = await requireAuthAndRole()
  if (error || !user) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const record = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        name: true,
        email: true,
        locale: true,
        hospital: { select: { locale: true } },
      },
    })

    if (!record) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        name: record.name,
        email: record.email,
        // null means "inherit" — the UI needs to tell that apart from a
        // deliberate choice, so it is returned as-is rather than resolved.
        locale: record.locale,
        hospitalLocale: record.hospital?.locale ?? null,
        effectiveLocale: resolveLocaleCascade(record.locale, record.hospital?.locale),
        supportedLocales: locales,
      },
    })
  } catch (err) {
    console.error('Get profile error:', err)
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const { error, user } = await requireAuthAndRole()
  if (error || !user) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { locale },
      select: { locale: true, hospital: { select: { locale: true } } },
    })

    return NextResponse.json({
      success: true,
      data: {
        locale: updated.locale,
        effectiveLocale: resolveLocaleCascade(updated.locale, updated.hospital?.locale),
      },
      message: locale ? 'Language updated' : 'Language reset to the clinic default',
    })
  } catch (err) {
    console.error('Update profile error:', err)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
