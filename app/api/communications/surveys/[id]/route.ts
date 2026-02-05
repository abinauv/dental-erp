import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const updateSurveySchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  validUntil: z.string().datetime().optional(),
});

// GET /api/communications/surveys/[id] - Get survey by ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole();

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const survey = await prisma.survey.findFirst({
      where: { id, hospitalId },
      include: {
        responses: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        _count: {
          select: {
            responses: true,
          },
        },
      },
    });

    if (!survey) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      );
    }

    // Parse questions and answers
    const parsedSurvey = {
      ...survey,
      questions: JSON.parse(survey.questions),
      responses: survey.responses.map(r => ({
        ...r,
        answers: JSON.parse(r.answers),
      })),
    };

    return NextResponse.json({
      success: true,
      data: parsedSurvey,
    });
  } catch (error: any) {
    console.error('Get survey error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get survey' },
      { status: 500 }
    );
  }
}

// PUT /api/communications/surveys/[id] - Update survey
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId, session } = await requireAuthAndRole();

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    if (!['ADMIN', 'DOCTOR'].includes(session?.user?.role || '')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify survey belongs to this hospital
    const existing = await prisma.survey.findFirst({
      where: { id, hospitalId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const data = updateSurveySchema.parse(body);

    const survey = await prisma.survey.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        isActive: data.isActive,
        validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      data: survey,
    });
  } catch (error: any) {
    console.error('Update survey error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update survey' },
      { status: 500 }
    );
  }
}

// DELETE /api/communications/surveys/[id] - Delete survey
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId, session } = await requireAuthAndRole();

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify survey belongs to this hospital
    const existing = await prisma.survey.findFirst({
      where: { id, hospitalId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      );
    }

    await prisma.survey.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Survey deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete survey error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete survey' },
      { status: 500 }
    );
  }
}
