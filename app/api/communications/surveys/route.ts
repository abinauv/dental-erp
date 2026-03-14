import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const createSurveySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  surveyType: z.enum(['SATISFACTION', 'NPS', 'FEEDBACK', 'TESTIMONIAL', 'SERVICE_QUALITY']),
  isAnonymous: z.boolean().optional(),
  questions: z.array(z.object({
    question: z.string(),
    type: z.enum(['text', 'rating', 'multiple_choice', 'yes_no']),
    required: z.boolean().optional(),
    options: z.array(z.string()).optional(),
  })),
  triggerType: z.enum(['POST_APPOINTMENT', 'POST_TREATMENT', 'MONTHLY', 'MANUAL']).optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
});

const updateSurveySchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  validUntil: z.string().datetime().optional(),
});

// POST /api/communications/surveys - Create survey
export async function POST(req: NextRequest) {
  const { error, hospitalId, session } = await requireAuthAndRole();

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (!['ADMIN', 'DOCTOR'].includes(session?.user?.role || '')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const data = createSurveySchema.parse(body);

    const survey = await prisma.survey.create({
      data: {
        hospitalId,
        title: data.title,
        description: data.description,
        surveyType: data.surveyType,
        isAnonymous: data.isAnonymous || false,
        questions: JSON.stringify(data.questions),
        triggerType: data.triggerType,
        validFrom: data.validFrom ? new Date(data.validFrom) : new Date(),
        validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: survey,
    });
  } catch (error: any) {
    console.error('Create survey error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create survey' },
      { status: 500 }
    );
  }
}

// GET /api/communications/surveys - Get surveys
export async function GET(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole();

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searchParams = req.nextUrl.searchParams;

    const where: any = { hospitalId };

    if (searchParams.get('surveyType')) {
      where.surveyType = searchParams.get('surveyType');
    }

    if (searchParams.get('isActive')) {
      where.isActive = searchParams.get('isActive') === 'true';
    }

    const surveys = await prisma.survey.findMany({
      where,
      include: {
        _count: {
          select: {
            responses: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Parse questions JSON
    const surveysWithParsedQuestions = surveys.map(survey => ({
      ...survey,
      questions: JSON.parse(survey.questions),
    }));

    return NextResponse.json({
      success: true,
      data: surveysWithParsedQuestions,
      count: surveys.length,
    });
  } catch (error: any) {
    console.error('Get surveys error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get surveys' },
      { status: 500 }
    );
  }
}
