import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { translateError } from '@/lib/i18n/api-messages'

/**
 * GET: Public endpoint — list active doctors for a hospital by slug.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params

    const hospital = await prisma.hospital.findUnique({
      where: { slug },
      select: { id: true, name: true, patientPortalEnabled: true },
    })

    if (!hospital) {
      return NextResponse.json({ error: await translateError('Clinic not found') }, { status: 404 })
    }

    if (!hospital.patientPortalEnabled) {
      return NextResponse.json(
        { error: await translateError('Online booking is not enabled') },
        { status: 403 }
      )
    }

    const doctors = await prisma.staff.findMany({
      where: {
        hospitalId: hospital.id,
        isActive: true,
        user: { role: 'DOCTOR' },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        specialization: true,
      },
      orderBy: { firstName: 'asc' },
    })

    return NextResponse.json({ doctors, hospitalName: hospital.name })
  } catch (err: unknown) {
    logger.error({ err }, 'Public doctors error:')
    return NextResponse.json(
      { error: await translateError('Failed to fetch doctors') },
      { status: 500 }
    )
  }
}
