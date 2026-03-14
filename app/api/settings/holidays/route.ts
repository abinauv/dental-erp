import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const createHolidaySchema = z.object({
  name: z.string().min(1),
  date: z.string().datetime(),
  isRecurring: z.boolean().optional(),
});

// GET /api/settings/holidays - Get all holidays
export async function GET(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole();
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const year = searchParams.get('year');

    const where: any = { hospitalId };

    if (year) {
      const yearNum = parseInt(year);
      where.date = {
        gte: new Date(`${yearNum}-01-01`),
        lte: new Date(`${yearNum}-12-31`),
      };
    }

    const holidays = await prisma.holiday.findMany({
      where,
      orderBy: {
        date: 'asc',
      },
    });

    return NextResponse.json({
      success: true,
      data: holidays,
      count: holidays.length,
    });
  } catch (error: any) {
    console.error('Get holidays error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get holidays' },
      { status: 500 }
    );
  }
}

// POST /api/settings/holidays - Create a new holiday
export async function POST(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN']);
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = createHolidaySchema.parse(body);

    const holiday = await prisma.holiday.create({
      data: {
        name: data.name,
        date: new Date(data.date),
        isRecurring: data.isRecurring || false,
        hospitalId,
      },
    });

    return NextResponse.json({
      success: true,
      data: holiday,
      message: 'Holiday created successfully',
    });
  } catch (error: any) {
    console.error('Create holiday error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create holiday' },
      { status: 500 }
    );
  }
}

// DELETE /api/settings/holidays?id=xxx - Delete a holiday
export async function DELETE(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN']);
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Holiday ID is required' },
        { status: 400 }
      );
    }

    await prisma.holiday.delete({
      where: { id, hospitalId },
    });

    return NextResponse.json({
      success: true,
      message: 'Holiday deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete holiday error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete holiday' },
      { status: 500 }
    );
  }
}
