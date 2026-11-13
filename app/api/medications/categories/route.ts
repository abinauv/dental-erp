import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { translateError } from '@/lib/i18n/api-messages'

// GET — distinct medication categories for this hospital
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return (
      error || NextResponse.json({ error: await translateError('Unauthorized') }, { status: 401 })
    )
  }

  try {
    const rows = await prisma.medication.findMany({
      where: { hospitalId, category: { not: null } },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    })

    const categories = rows.map((r) => r.category).filter(Boolean)

    return NextResponse.json({ success: true, data: categories })
  } catch (err: any) {
    return NextResponse.json({ error: await translateError(err.message) }, { status: 500 })
  }
}
