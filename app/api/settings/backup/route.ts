import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';
import { format } from 'date-fns';

// GET /api/settings/backup - Export database data
export async function GET(req: NextRequest) {
  const { error, hospitalId, user } = await requireAuthAndRole(['ADMIN']);
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get('type') || 'full';

    let data: any = {};

    if (type === 'full' || type === 'patients') {
      data.patients = await prisma.patient.findMany({
        where: { hospitalId },
        include: {
          medicalHistory: true,
        },
      });
    }

    if (type === 'full' || type === 'appointments') {
      data.appointments = await prisma.appointment.findMany({
        where: { hospitalId },
      });
    }

    if (type === 'full' || type === 'treatments') {
      data.treatments = await prisma.treatment.findMany({
        where: { hospitalId },
      });
      data.treatmentPlans = await prisma.treatmentPlan.findMany({
        where: { hospitalId },
        include: {
          items: true,
        },
      });
    }

    if (type === 'full' || type === 'billing') {
      data.invoices = await prisma.invoice.findMany({
        where: { hospitalId },
        include: {
          items: true,
        },
      });
      data.payments = await prisma.payment.findMany({
        where: { hospitalId },
      });
    }

    if (type === 'full' || type === 'inventory') {
      data.inventoryItems = await prisma.inventoryItem.findMany({
        where: { hospitalId },
      });
      data.stockTransactions = await prisma.stockTransaction.findMany({
        where: { hospitalId },
      });
    }

    if (type === 'full' || type === 'settings') {
      data.settings = await prisma.setting.findMany({
        where: { hospitalId },
      });
      data.clinicInfo = await prisma.hospital.findUnique({
        where: { id: hospitalId },
        select: {
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
        },
      });
      data.holidays = await prisma.holiday.findMany({
        where: { hospitalId },
      });
    }

    // Create backup metadata
    const backup = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      exportedBy: user?.email,
      type,
      data,
    };

    // Return as JSON download
    const filename = `dental-erp-backup-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`;

    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Backup export error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to export backup' },
      { status: 500 }
    );
  }
}

// POST /api/settings/backup - Get backup statistics
export async function POST(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN']);
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get counts of all major entities
    const stats = {
      patients: await prisma.patient.count({ where: { hospitalId } }),
      appointments: await prisma.appointment.count({ where: { hospitalId } }),
      treatments: await prisma.treatment.count({ where: { hospitalId } }),
      invoices: await prisma.invoice.count({ where: { hospitalId } }),
      payments: await prisma.payment.count({ where: { hospitalId } }),
      inventoryItems: await prisma.inventoryItem.count({ where: { hospitalId } }),
      staff: await prisma.staff.count({ where: { hospitalId } }),
      labOrders: await prisma.labOrder.count({ where: { hospitalId } }),
    };

    return NextResponse.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Backup stats error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get backup statistics' },
      { status: 500 }
    );
  }
}
