import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { isSupportedLocale } from '@/lib/i18n/config'
import { logger } from '@/lib/logger'

const optionalString = z.preprocess(
  (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
  z.string().optional()
)

/** A string that parses to a real IANA time zone (e.g. "Asia/Kolkata"). */
function isValidTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

const clinicInfoSchema = z.object({
  name: z.string().min(1),
  tagline: optionalString,
  logo: optionalString,
  phone: z.string().min(10),
  alternatePhone: optionalString,
  email: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    z.string().email().optional()
  ),
  website: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    z.string().url().optional()
  ),
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().min(6),
  registrationNo: optionalString,
  gstNumber: optionalString,
  panNumber: optionalString,
  workingHours: optionalString,
  bankName: optionalString,
  bankAccountNo: optionalString,
  bankIfsc: optionalString,
  upiId: optionalString,
  patientPortalEnabled: z.boolean().optional(),
  // Regional settings. All have non-null DB defaults, so each is optional here
  // and an omitted field leaves the stored value unchanged.
  locale: optionalString.refine((v) => v === undefined || isSupportedLocale(v), {
    message: 'Unsupported locale',
  }),
  country: optionalString.refine((v) => v === undefined || /^[A-Z]{2}$/.test(v), {
    message: 'Country must be a 2-letter ISO 3166-1 code',
  }),
  currency: optionalString.refine((v) => v === undefined || /^[A-Z]{3}$/.test(v), {
    message: 'Currency must be a 3-letter ISO 4217 code',
  }),
  timezone: optionalString.refine((v) => v === undefined || isValidTimeZone(v), {
    message: 'Unknown time zone',
  }),
})

// GET /api/settings/clinic - Get clinic information
export async function GET(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const clinicInfo = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: {
        id: true,
        name: true,
        tagline: true,
        logo: true,
        phone: true,
        alternatePhone: true,
        email: true,
        website: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        registrationNo: true,
        gstNumber: true,
        panNumber: true,
        workingHours: true,
        bankName: true,
        bankAccountNo: true,
        bankIfsc: true,
        upiId: true,
        slug: true,
        patientPortalEnabled: true,
        locale: true,
        country: true,
        currency: true,
        timezone: true,
      },
    })

    if (!clinicInfo) {
      // Return default structure if not found
      return NextResponse.json({
        success: true,
        data: null,
      })
    }

    return NextResponse.json({
      success: true,
      data: clinicInfo,
    })
  } catch (error: any) {
    logger.error({ err: error }, 'Get clinic info error:')
    return NextResponse.json(
      { error: error.message || 'Failed to get clinic information' },
      { status: 500 }
    )
  }
}

// POST /api/settings/clinic - Create or update clinic information
export async function POST(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN'])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const data = clinicInfoSchema.parse(body)

    const clinicInfo = await prisma.hospital.update({
      where: { id: hospitalId },
      data,
    })

    return NextResponse.json({
      success: true,
      data: clinicInfo,
      message: 'Clinic information saved successfully',
    })
  } catch (error: any) {
    logger.error({ err: error }, 'Update clinic info error:')
    return NextResponse.json(
      { error: error.message || 'Failed to update clinic information' },
      { status: 500 }
    )
  }
}
