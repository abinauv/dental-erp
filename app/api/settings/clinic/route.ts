import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const optionalString = z.preprocess(
  (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
  z.string().optional()
);

const clinicInfoSchema = z.object({
  name: z.string().min(1),
  tagline: optionalString,
  logo: optionalString,
  phone: z.string().min(10),
  alternatePhone: optionalString,
  email: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    z.string().email().optional()
  ),
  website: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    z.string().url().optional()
  ),
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().min(6),
  registrationNo: optionalString,
  gstNumber: optionalString,
  panNumber: optionalString,
  workingHours: optionalString,
  bankName: optionalString,
  bankAccountNo: optionalString,
  bankIfsc: optionalString,
  upiId: optionalString,
  patientPortalEnabled: z.boolean().optional(),
});

// GET /api/settings/clinic - Get clinic information
export async function GET(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole();
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const clinicInfo = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: {
        id: true,
        name: true,
        tagline: true,
        logo: true,
        phone: true,
        alternatePhone: true,
        email: true,
        website: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        registrationNo: true,
        gstNumber: true,
        panNumber: true,
        workingHours: true,
        bankName: true,
        bankAccountNo: true,
        bankIfsc: true,
        upiId: true,
        slug: true,
        patientPortalEnabled: true,
      },
    });

    if (!clinicInfo) {
      // Return default structure if not found
      return NextResponse.json({
        success: true,
        data: null,
      });
    }

    return NextResponse.json({
      success: true,
      data: clinicInfo,
    });
  } catch (error: any) {
    console.error('Get clinic info error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get clinic information' },
      { status: 500 }
    );
  }
}

// POST /api/settings/clinic - Create or update clinic information
export async function POST(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN']);
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = clinicInfoSchema.parse(body);

    const clinicInfo = await prisma.hospital.update({
      where: { id: hospitalId },
      data,
    });

    return NextResponse.json({
      success: true,
      data: clinicInfo,
      message: 'Clinic information saved successfully',
    });
  } catch (error: any) {
    console.error('Update clinic info error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update clinic information' },
      { status: 500 }
    );
  }
}
