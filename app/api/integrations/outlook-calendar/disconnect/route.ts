import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { translateError } from '@/lib/i18n/api-messages'

// POST /api/integrations/outlook-calendar/disconnect — Remove integration
export async function POST(req: NextRequest) {
  const { error, session } = await requireAuthAndRole()
  if (error || !session) {
    return (
      error || NextResponse.json({ error: await translateError('Unauthorized') }, { status: 401 })
    )
  }

  try {
    await prisma.calendarIntegration.deleteMany({
      where: {
        userId: session.user.id,
        provider: 'OUTLOOK',
      },
    })

    return NextResponse.json({ message: 'Outlook Calendar disconnected' })
  } catch (err) {
    logger.error({ err }, 'Error disconnecting calendar:')
    return NextResponse.json(
      { error: await translateError('Failed to disconnect calendar') },
      { status: 500 }
    )
  }
}
