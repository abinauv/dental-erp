import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN', 'ACCOUNTANT'])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: patientId } = await params

  try {
    const { policyId } = await req.json()

    if (!policyId) {
      return NextResponse.json({ error: 'Policy ID is required' }, { status: 400 })
    }

    // Manual verification — update status and timestamp
    const result = await prisma.patientInsurance.updateMany({
      where: { id: policyId, hospitalId, patientId },
      data: {
        lastVerifiedAt: new Date(),
        verificationStatus: 'VERIFIED',
      },
    })

    if (result.count === 0) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, verifiedAt: new Date().toISOString() })
  } catch (err) {
    logger.error({ err }, 'Insurance verification error:')
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
  }
}
