import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole } from '@/lib/api-helpers';
import { emailService } from '@/lib/services/email.service';
import { z } from 'zod';

const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  patientId: z.string().optional(),
  templateId: z.string().optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    path: z.string().optional(),
    content: z.string().optional(),
    contentType: z.string().optional(),
  })).optional(),
  scheduledFor: z.string().datetime().optional(),
});

const sendWithTemplateSchema = z.object({
  to: z.string().email(),
  templateId: z.string(),
  variables: z.record(z.string(), z.any()),
  attachments: z.array(z.object({
    filename: z.string(),
    path: z.string().optional(),
    content: z.string().optional(),
    contentType: z.string().optional(),
  })).optional(),
  patientId: z.string().optional(),
});

// POST /api/communications/email - Send email
export async function POST(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole();
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Check if it's a template-based email
    if (body.templateId && body.variables) {
      const data = sendWithTemplateSchema.parse(body);

      const emailLogId = await emailService.sendWithTemplate(
        data.to,
        data.templateId,
        data.variables,
        data.attachments,
        data.patientId,
        hospitalId
      );

      return NextResponse.json({
        success: true,
        emailLogId,
        message: 'Email sent successfully',
      });
    } else {
      const data = sendEmailSchema.parse(body);

      const emailLogId = await emailService.sendEmail({
        to: data.to,
        subject: data.subject,
        body: data.body,
        patientId: data.patientId,
        templateId: data.templateId,
        attachments: data.attachments,
        scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : undefined,
        hospitalId,
      });

      return NextResponse.json({
        success: true,
        emailLogId,
        message: data.scheduledFor ? 'Email scheduled successfully' : 'Email sent successfully',
      });
    }
  } catch (error: any) {
    console.error('Email send error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500 }
    );
  }
}

// GET /api/communications/email - Get email history
export async function GET(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole();
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const searchParams = req.nextUrl.searchParams;

    const filters = {
      patientId: searchParams.get('patientId') || undefined,
      email: searchParams.get('email') || undefined,
      status: searchParams.get('status') || undefined,
      from: searchParams.get('from') ? new Date(searchParams.get('from')!) : undefined,
      to: searchParams.get('to') ? new Date(searchParams.get('to')!) : undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100,
      hospitalId,
    };

    const history = await emailService.getEmailHistory(filters);

    return NextResponse.json({
      success: true,
      data: history,
      count: history.length,
    });
  } catch (error: any) {
    console.error('Get email history error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get email history' },
      { status: 500 }
    );
  }
}
