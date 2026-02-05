import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole } from '@/lib/api-helpers';
import { smsService } from '@/lib/services/sms.service';
import { z } from 'zod';

const bulkSMSSchema = z.object({
  recipients: z.array(z.object({
    phone: z.string().min(10),
    message: z.string().min(1).max(500),
    patientId: z.string().optional(),
  })).min(1).max(100),
  templateId: z.string().optional(),
});

// POST /api/communications/sms/bulk - Send bulk SMS
export async function POST(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole();
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = bulkSMSSchema.parse(body);

    const results = await smsService.sendBulkSMS(
      data.recipients.map(r => ({
        phone: r.phone,
        message: r.message,
        patientId: r.patientId,
        templateId: data.templateId,
        hospitalId,
      }))
    );

    const successCount = results.filter(r => r).length;
    const failedCount = results.length - successCount;

    return NextResponse.json({
      success: true,
      totalRecipients: results.length,
      successCount,
      failedCount,
      results,
    });
  } catch (error: any) {
    console.error('Bulk SMS send error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send bulk SMS' },
      { status: 500 }
    );
  }
}
