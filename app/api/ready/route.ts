import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Readiness probe. Answers a different question from /api/health: can this
// instance actually serve useful traffic right now?
//
// This one does check the database, because an instance that cannot reach it
// should be pulled out of the load balancer. The distinction matters: a failing
// readiness probe means "stop sending traffic", a failing liveness probe means
// "replace this container". Conflating them turns a database blip into a
// cascade of restarts.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Cheapest possible round trip that proves the connection pool works.
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json(
      { status: 'ready', checks: { database: 'ok' } },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    // Return 503 rather than throwing. An unhandled throw here becomes a 500,
    // which is indistinguishable from the app being broken in some other way —
    // 503 is the specific, correct signal for "not ready yet".
    console.error('[ready] database check failed:', error)

    // The detail stays in the logs. This endpoint is unauthenticated, and a
    // driver error can carry the host, port and user of the database.
    return NextResponse.json(
      { status: 'not_ready', checks: { database: 'error' } },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
