import { NextResponse } from 'next/server'
import { drainOutbox } from '@/lib/services/outbox.service'
import { logger } from '@/lib/logger'
import { translateError } from '@/lib/i18n/api-messages'

/**
 * GET /api/cron/outbox
 * Sends scheduled email and SMS that are due.
 *
 * The app already does this every minute by itself (OUTBOX_INTERVAL_SECONDS).
 * This route is for running it from an external scheduler instead, with the
 * in-app timer turned off. Safe to run alongside it: each message is claimed
 * before it's sent, so none goes out twice.
 *
 * Secured via CRON_SECRET Bearer token.
 */
export async function GET(req: Request) {
  const secret = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!secret || !process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: await translateError('Unauthorized') }, { status: 401 })
  }

  try {
    const result = await drainOutbox()
    return NextResponse.json({ ...result, processedAt: new Date().toISOString() })
  } catch (err) {
    logger.error({ err }, '[outbox] cron run failed')
    return NextResponse.json({ error: await translateError('Outbox run failed') }, { status: 500 })
  }
}

export const POST = GET
