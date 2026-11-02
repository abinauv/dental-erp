import { NextRequest, NextResponse } from 'next/server'
import { communicationTriggersService } from '@/lib/services/communication-triggers.service'
import { enqueue } from '@/lib/queue'
import { logger } from '@/lib/logger'

// POST /api/communications/triggers - Run communication triggers
// This endpoint should be called by a cron job (e.g., every hour)
export async function POST(req: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'your-cron-secret-key'

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Run all automated communication triggers. With a queue configured this
    // hands the long send loop to the worker (durable, retried, survives a
    // restart) and returns immediately; without one it runs inline as before.
    const { queued } = await enqueue('run-communication-triggers', {})

    return NextResponse.json({
      success: true,
      message: queued
        ? 'Communication triggers queued'
        : 'Communication triggers executed successfully',
      queued,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    logger.error({ err: error }, 'Communication triggers error:')
    return NextResponse.json(
      { error: error.message || 'Failed to run communication triggers' },
      { status: 500 }
    )
  }
}

// GET /api/communications/triggers - Manual trigger (for testing)
export async function GET(req: NextRequest) {
  try {
    // Only allow in development or with admin authentication
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Manual triggers not allowed in production' },
        { status: 403 }
      )
    }

    await communicationTriggersService.runAllTriggers()

    return NextResponse.json({
      success: true,
      message: 'Communication triggers executed successfully',
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    logger.error({ err: error }, 'Communication triggers error:')
    return NextResponse.json(
      { error: error.message || 'Failed to run communication triggers' },
      { status: 500 }
    )
  }
}
