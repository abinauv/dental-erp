import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole } from '@/lib/api-helpers';
import { templateService } from '@/lib/services/template.service';
import { z } from 'zod';

const createTemplateSchema = z.object({
  name: z.string().min(1),
  category: z.enum(['APPOINTMENT', 'PAYMENT', 'BIRTHDAY', 'PROMOTIONAL', 'FOLLOW_UP', 'LAB_WORK', 'PRESCRIPTION', 'GENERAL']),
  channel: z.enum(['SMS', 'EMAIL', 'WHATSAPP', 'IN_APP']),
  subject: z.string().optional(),
  content: z.string().min(1),
  language: z.string().optional(),
  isDefault: z.boolean().optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().optional(),
  subject: z.string().optional(),
  content: z.string().optional(),
  language: z.string().optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

// POST /api/communications/templates - Create template
export async function POST(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN', 'DOCTOR']);
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = createTemplateSchema.parse(body);

    // Validate template
    const validation = templateService.validateTemplate(data.content);

    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: 'Template validation failed',
          validationErrors: validation.errors,
          unknownVariables: validation.unknownVariables,
        },
        { status: 400 }
      );
    }

    const template = await templateService.createTemplate({ ...data, hospitalId });

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error: any) {
    console.error('Create template error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create template' },
      { status: 500 }
    );
  }
}

// GET /api/communications/templates - Get templates
export async function GET(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole();
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const searchParams = req.nextUrl.searchParams;

    const filters: any = {};

    if (searchParams.get('category')) {
      filters.category = searchParams.get('category');
    }

    if (searchParams.get('channel')) {
      filters.channel = searchParams.get('channel');
    }

    if (searchParams.get('language')) {
      filters.language = searchParams.get('language');
    }

    if (searchParams.get('isActive')) {
      filters.isActive = searchParams.get('isActive') === 'true';
    }

    const templates = await templateService.getTemplates(hospitalId, filters);

    return NextResponse.json({
      success: true,
      data: templates,
      count: templates.length,
    });
  } catch (error: any) {
    console.error('Get templates error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get templates' },
      { status: 500 }
    );
  }
}
