import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const procedureSchema = z.object({
  code: z.string().min(1).toUpperCase(),
  name: z.string().min(1),
  category: z.enum([
    'PREVENTIVE',
    'RESTORATIVE',
    'ENDODONTIC',
    'PERIODONTIC',
    'PROSTHODONTIC',
    'ORTHODONTIC',
    'ORAL_SURGERY',
    'COSMETIC',
    'DIAGNOSTIC',
    'EMERGENCY'
  ]),
  description: z.string().optional(),
  defaultDuration: z.number().int().positive().default(30),
  basePrice: z.number().positive(),
  materials: z.string().optional(),
  preInstructions: z.string().optional(),
  postInstructions: z.string().optional(),
  isActive: z.boolean().default(true),
});

// GET /api/settings/procedures - Get all procedures
export async function GET(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole();
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const category = searchParams.get('category');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: any = { hospitalId };
    if (category) where.category = category;

    const [procedures, total] = await Promise.all([
      prisma.procedure.findMany({
        where,
        orderBy: [
          { category: 'asc' },
          { name: 'asc' }
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.procedure.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: procedures,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Get procedures error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get procedures' },
      { status: 500 }
    );
  }
}

// POST /api/settings/procedures - Create new procedure
export async function POST(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN']);
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = procedureSchema.parse(body);

    // Check if code already exists for this hospital
    const existing = await prisma.procedure.findFirst({
      where: { code: data.code, hospitalId },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Procedure code already exists' },
        { status: 400 }
      );
    }

    const procedure = await prisma.procedure.create({
      data: {
        ...data,
        hospitalId,
      },
    });

    return NextResponse.json({
      success: true,
      data: procedure,
      message: 'Procedure created successfully',
    });
  } catch (error: any) {
    console.error('Create procedure error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create procedure' },
      { status: 500 }
    );
  }
}
