import { NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/sterilization/logs
 * List sterilization logs with filters
 */
export async function GET(req: Request) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN', 'DOCTOR'])
  if (error) return error

  const { searchParams } = new URL(req.url)
  const instrumentId = searchParams.get('instrumentId')
  const result = searchParams.get('result')
  const method = searchParams.get('method')
  const limit = Number(searchParams.get('limit') || '50')

  const where: Record<string, unknown> = { hospitalId: hospitalId! }
  if (instrumentId) where.instrumentId = instrumentId
  if (result) where.result = result
  if (method) where.method = method

  const logs = await prisma.sterilizationLog.findMany({
    where,
    include: {
      instrument: { select: { id: true, name: true, category: true, serialNumber: true } },
    },
    orderBy: { startedAt: 'desc' },
    take: limit,
  })

  return NextResponse.json({
    logs: logs.map((l) => ({
      ...l,
      temperature: l.temperature?.toNumber() ?? null,
      pressure: l.pressure?.toNumber() ?? null,
    })),
  })
}

/**
 * POST /api/sterilization/logs
 * Record a sterilization cycle. Auto-updates instrument status and cycle count.
 */
export async function POST(req: Request) {
  const { error, hospitalId, user } = await requireAuthAndRole(['ADMIN', 'DOCTOR'])
  if (error) return error

  const body = await req.json()
  const {
    instrumentId,
    method,
    machineId,
    temperature,
    pressure,
    duration,
    result,
    biologicalIndicator,
    chemicalIndicator,
    notes,
    startedAt,
    completedAt,
  } = body

  if (!instrumentId || !method || !startedAt) {
    return NextResponse.json(
      { error: 'instrumentId, method, and startedAt are required' },
      { status: 400 }
    )
  }

  // Verify instrument belongs to hospital
  const instrument = await prisma.instrument.findFirst({
    where: { id: instrumentId, hospitalId: hospitalId! },
  })
  if (!instrument) {
    return NextResponse.json({ error: 'Instrument not found' }, { status: 404 })
  }

  const cycleNumber = instrument.sterilizationCycleCount + 1
  const logResult = result || 'PASS'

  // Create log + update instrument in a transaction
  const [log] = await prisma.$transaction([
    prisma.sterilizationLog.create({
      data: {
        hospitalId: hospitalId!,
        instrumentId,
        cycleNumber,
        method,
        machineId: machineId || null,
        temperature: temperature ? Number(temperature) : null,
        pressure: pressure ? Number(pressure) : null,
        duration: duration ? Number(duration) : null,
        operatorId: user!.id,
        result: logResult,
        biologicalIndicator: biologicalIndicator ?? false,
        chemicalIndicator: chemicalIndicator ?? false,
        notes: notes || null,
        startedAt: new Date(startedAt),
        completedAt: completedAt ? new Date(completedAt) : null,
      },
    }),
    prisma.instrument.update({
      where: { id: instrumentId },
      data: {
        sterilizationCycleCount: cycleNumber,
        lastSterilizedAt: completedAt ? new Date(completedAt) : new Date(startedAt),
        status: logResult === 'PASS' ? 'AVAILABLE' : 'MAINTENANCE',
      },
    }),
  ])

  return NextResponse.json({ log }, { status: 201 })
}
