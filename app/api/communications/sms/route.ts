import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { smsService } from '@/lib/services/sms.service'
import { z } from 'zod'
import { logger } from '@/lib/logger'

const sendSMSSchema = z.object({
  phone: z.string().min(10),
  message: z.string().min(1).max(500),
  patientId: z.string().optional(),
  templateId: z.string().optional(),
  scheduledFor: z.string().datetime().optional(),
})

// Query-string filters for GET. Dates may be plain dates or full timestamps.
const historySchema = z.object({
  patientId: z.string().optional(),
  phone: z.string().optional(),
  status: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
})

// POST /api/communications/sms - Send SMS
export async function POST(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const data = sendSMSSchema.parse(body)

    const smsLogId = await smsService.sendSMS({
      phone: data.phone,
      message: data.message,
      patientId: data.patientId,
      templateId: data.templateId,
      scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : undefined,
      hospitalId,
    })

    return NextResponse.json({
      success: true,
      smsLogId,
      message: data.scheduledFor ? 'SMS scheduled successfully' : 'SMS sent successfully',
    })
  } catch (error: any) {
    logger.error({ err: error }, 'SMS send error:')
    return NextResponse.json({ error: error.message || 'Failed to send SMS' }, { status: 500 })
  }
}

// GET /api/communications/sms - Get SMS history
export async function GET(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const searchParams = req.nextUrl.searchParams
    const query = historySchema.safeParse({
      patientId: searchParams.get('patientId') || undefined,
      phone: searchParams.get('phone') || undefined,
      status: searchParams.get('status') || undefined,
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      limit: searchParams.get('limit') || undefined,
    })
    if (!query.success) {
      return NextResponse.json(
        { error: 'Invalid filters', details: query.error.flatten() },
        { status: 400 }
      )
    }

    const history = await smsService.getSMSHistory({ ...query.data, hospitalId })

    return NextResponse.json({
      success: true,
      data: history,
      count: history.length,
    })
  } catch (error: any) {
    logger.error({ err: error }, 'Get SMS history error:')
    return NextResponse.json(
      { error: error.message || 'Failed to get SMS history' },
      { status: 500 }
    )
  }
}
