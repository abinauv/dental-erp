import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePatientAuth } from '@/lib/patient-auth'
import { logger } from '@/lib/logger'

/**
 * GET: List doctors for the patient's hospital.
 */
export async function GET(req: NextRequest) {
  const { error, patient } = await requirePatientAuth(req)
  if (error) return error

  try {
    const doctors = await prisma.staff.findMany({
      where: {
        hospitalId: patient!.hospitalId,
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

    return NextResponse.json({ doctors })
  } catch (err: unknown) {
    logger.error({ err }, 'Portal doctors error:')
    return NextResponse.json({ error: 'Failed to fetch doctors' }, { status: 500 })
  }
}
