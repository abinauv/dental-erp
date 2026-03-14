import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const procedureUpdateSchema = z.object({
  code: z.string().min(1).toUpperCase().optional(),
  name: z.string().min(1).optional(),
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
  ]).optional(),
  description: z.string().optional(),
  defaultDuration: z.number().int().positive().optional(),
  basePrice: z.number().positive().optional(),
  materials: z.string().optional(),
  preInstructions: z.string().optional(),
  postInstructions: z.string().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/settings/procedures/[id] - Get single procedure
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error, hospitalId } = await requireAuthAndRole();
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const procedure = await prisma.procedure.findUnique({
      where: { id, hospitalId },
    });

    if (!procedure) {
      return NextResponse.json(
        { error: 'Procedure not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: procedure,
    });
  } catch (error: any) {
    console.error('Get procedure error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get procedure' },
      { status: 500 }
    );
  }
}

// PUT /api/settings/procedures/[id] - Update procedure
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN']);
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = procedureUpdateSchema.parse(body);

    // Check if procedure exists
    const existing = await prisma.procedure.findUnique({
      where: { id, hospitalId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Procedure not found' },
        { status: 404 }
      );
    }

    // If code is being updated, check if it's unique within this hospital
    if (data.code && data.code !== existing.code) {
      const codeExists = await prisma.procedure.findFirst({
        where: { code: data.code, hospitalId },
      });

      if (codeExists) {
        return NextResponse.json(
          { error: 'Procedure code already exists' },
          { status: 400 }
        );
      }
    }

    const procedure = await prisma.procedure.update({
      where: { id, hospitalId },
      data,
    });

    return NextResponse.json({
      success: true,
      data: procedure,
      message: 'Procedure updated successfully',
    });
  } catch (error: any) {
    console.error('Update procedure error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update procedure' },
      { status: 500 }
    );
  }
}

// DELETE /api/settings/procedures/[id] - Deactivate procedure
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN']);
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if procedure exists
    const existing = await prisma.procedure.findUnique({
      where: { id, hospitalId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Procedure not found' },
        { status: 404 }
      );
    }

    // Soft delete by setting isActive to false
    const procedure = await prisma.procedure.update({
      where: { id, hospitalId },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      data: procedure,
      message: 'Procedure deactivated successfully',
    });
  } catch (error: any) {
    console.error('Delete procedure error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete procedure' },
      { status: 500 }
    );
  }
}
