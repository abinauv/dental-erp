import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const submitResponseSchema = z.object({
  patientId: z.string().optional(),
  answers: z.record(z.string(), z.any()),
  rating: z.number().min(1).max(5).optional(),
});

// POST /api/communications/surveys/[id]/responses - Submit survey response
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = submitResponseSchema.parse(body);

    // Check if survey exists and is active
    const survey = await prisma.survey.findUnique({
      where: { id },
    });

    if (!survey) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      );
    }

    if (!survey.isActive) {
      return NextResponse.json(
        { error: 'Survey is not active' },
        { status: 400 }
      );
    }

    // Check if survey is still valid
    if (survey.validUntil && new Date() > survey.validUntil) {
      return NextResponse.json(
        { error: 'Survey has expired' },
        { status: 400 }
      );
    }

    // Determine sentiment based on rating
    let sentiment: string | undefined;
    if (data.rating) {
      if (data.rating >= 4) sentiment = 'positive';
      else if (data.rating === 3) sentiment = 'neutral';
      else sentiment = 'negative';
    }

    // Get IP and user agent for tracking
    const ipAddress = req.headers.get('x-forwarded-for') ||
                     req.headers.get('x-real-ip') ||
                     'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Create response
    const response = await prisma.surveyResponse.create({
      data: {
        surveyId: id,
        patientId: data.patientId,
        answers: JSON.stringify(data.answers),
        rating: data.rating,
        sentiment,
        isComplete: true,
        ipAddress,
        userAgent,
      },
    });

    return NextResponse.json({
      success: true,
      data: response,
      message: 'Thank you for your feedback!',
    });
  } catch (error: any) {
    console.error('Submit survey response error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit response' },
      { status: 500 }
    );
  }
}

// GET /api/communications/surveys/[id]/responses - Get survey responses
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // This endpoint requires authentication
    // const session = await auth();
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const searchParams = req.nextUrl.searchParams;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100;

    const responses = await prisma.surveyResponse.findMany({
      where: {
        surveyId: id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    // Parse answers
    const parsedResponses = responses.map(r => ({
      ...r,
      answers: JSON.parse(r.answers),
    }));

    // Calculate statistics
    const totalResponses = responses.length;
    const avgRating = responses.filter(r => r.rating).length > 0
      ? responses.reduce((sum, r) => sum + (r.rating || 0), 0) / responses.filter(r => r.rating).length
      : 0;

    const sentimentCounts = {
      positive: responses.filter(r => r.sentiment === 'positive').length,
      neutral: responses.filter(r => r.sentiment === 'neutral').length,
      negative: responses.filter(r => r.sentiment === 'negative').length,
    };

    return NextResponse.json({
      success: true,
      data: parsedResponses,
      statistics: {
        totalResponses,
        avgRating: Math.round(avgRating * 10) / 10,
        sentimentCounts,
      },
    });
  } catch (error: any) {
    console.error('Get survey responses error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get responses' },
      { status: 500 }
    );
  }
}
