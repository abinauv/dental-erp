import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole } from '@/lib/api-helpers';
import { smsService } from '@/lib/services/sms.service';
import { z } from 'zod';

const sendSMSSchema = z.object({
  phone: z.string().min(10),
  message: z.string().min(1).max(500),
  patientId: z.string().optional(),
  templateId: z.string().optional(),
  scheduledFor: z.string().datetime().optional(),
});

const bulkSMSSchema = z.object({
  recipients: z.array(z.object({
    phone: z.string().min(10),
    message: z.string().min(1).max(500),
    patientId: z.string().optional(),
  })),
  templateId: z.string().optional(),
});

const historySchema = z.object({
  patientId: z.string().optional(),
  phone: z.string().optional(),
  status: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.number().min(1).max(1000).optional(),
});

// POST /api/communications/sms - Send SMS
export async function POST(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole();
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = sendSMSSchema.parse(body);

    const smsLogId = await smsService.sendSMS({
      phone: data.phone,
      message: data.message,
      patientId: data.patientId,
      templateId: data.templateId,
      scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : undefined,
      hospitalId,
    });

    return NextResponse.json({
      success: true,
      smsLogId,
      message: data.scheduledFor ? 'SMS scheduled successfully' : 'SMS sent successfully',
    });
  } catch (error: any) {
    console.error('SMS send error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send SMS' },
      { status: 500 }
    );
  }
}

// GET /api/communications/sms - Get SMS history
export async function GET(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole();
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const searchParams = req.nextUrl.searchParams;

    const filters = {
      patientId: searchParams.get('patientId') || undefined,
      phone: searchParams.get('phone') || undefined,
      status: searchParams.get('status') || undefined,
      from: searchParams.get('from') ? new Date(searchParams.get('from')!) : undefined,
      to: searchParams.get('to') ? new Date(searchParams.get('to')!) : undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100,
      hospitalId,
    };

    const history = await smsService.getSMSHistory(filters);

    return NextResponse.json({
      success: true,
      data: history,
      count: history.length,
    });
  } catch (error: any) {
    console.error('Get SMS history error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get SMS history' },
      { status: 500 }
    );
  }
}
