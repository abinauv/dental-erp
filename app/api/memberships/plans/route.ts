import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { translateError } from '@/lib/i18n/api-messages'

// GET - List membership plans
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return (
      error || NextResponse.json({ error: await translateError('Unauthorized') }, { status: 401 })
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('activeOnly') === 'true'

    const where: any = { hospitalId }
    if (activeOnly) where.isActive = true

    const plans = await prisma.membershipPlan.findMany({
      where,
      include: {
        _count: { select: { memberships: true } },
      },
      orderBy: { price: 'asc' },
    })

    return NextResponse.json(plans)
  } catch (err) {
    logger.error({ err }, 'Error fetching membership plans:')
    return NextResponse.json(
      { error: await translateError('Failed to fetch plans') },
      { status: 500 }
    )
  }
}

// POST - Create membership plan
export async function POST(request: NextRequest) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return (
      error || NextResponse.json({ error: await translateError('Unauthorized') }, { status: 401 })
    )
  }

  try {
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: await translateError('Only admins can create plans') },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, description, price, duration, benefits, maxMembers } = body

    if (!name?.trim()) {
      return NextResponse.json(
        { error: await translateError('Plan name is required') },
        { status: 400 }
      )
    }
    if (!price || price <= 0) {
      return NextResponse.json(
        { error: await translateError('Valid price is required') },
        { status: 400 }
      )
    }
    if (!duration || duration <= 0) {
      return NextResponse.json(
        { error: await translateError('Valid duration (months) is required') },
        { status: 400 }
      )
    }

    const plan = await prisma.membershipPlan.create({
      data: {
        hospitalId,
        name: name.trim(),
        description: description?.trim() || null,
        price,
        duration,
        benefits: benefits || [],
        maxMembers: maxMembers || null,
      },
    })

    return NextResponse.json(plan, { status: 201 })
  } catch (err) {
    logger.error({ err }, 'Error creating membership plan:')
    return NextResponse.json(
      { error: await translateError('Failed to create plan') },
      { status: 500 }
    )
  }
}
