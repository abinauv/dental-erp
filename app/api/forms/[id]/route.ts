import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { translateError } from '@/lib/i18n/api-messages'

// GET: Single submission detail
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return (
      error || NextResponse.json({ error: await translateError('Unauthorized') }, { status: 401 })
    )
  }

  try {
    const submission = await prisma.formSubmission.findFirst({
      where: { id, hospitalId },
      include: {
        template: true,
      },
    })

    if (!submission) {
      return NextResponse.json(
        { error: await translateError('Submission not found') },
        { status: 404 }
      )
    }

    return NextResponse.json({ submission })
  } catch (err) {
    logger.error({ err }, 'Get submission error:')
    return NextResponse.json(
      { error: await translateError('Failed to get submission') },
      { status: 500 }
    )
  }
}

// PUT: Review/approve/reject a submission
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error, hospitalId, user } = await requireAuthAndRole(['ADMIN', 'DOCTOR'])
  if (error || !hospitalId) {
    return (
      error || NextResponse.json({ error: await translateError('Unauthorized') }, { status: 401 })
    )
  }

  try {
    const existing = await prisma.formSubmission.findFirst({
      where: { id, hospitalId },
    })
    if (!existing) {
      return NextResponse.json(
        { error: await translateError('Submission not found') },
        { status: 404 }
      )
    }

    const body = await req.json()
    const { status, reviewNotes } = body

    if (!['REVIEWED', 'APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ error: await translateError('Invalid status') }, { status: 400 })
    }

    const submission = await prisma.formSubmission.update({
      where: { id },
      data: {
        status,
        reviewedBy: user?.id,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || null,
      },
    })

    return NextResponse.json({ submission })
  } catch (err) {
    logger.error({ err }, 'Review submission error:')
    return NextResponse.json(
      { error: await translateError('Failed to update submission') },
      { status: 500 }
    )
  }
}
