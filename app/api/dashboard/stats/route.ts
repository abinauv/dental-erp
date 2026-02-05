import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subDays, subMonths } from 'date-fns';

// Helper function to convert BigInt to Number in query results
function convertBigIntToNumber(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return Number(obj);
  if (Array.isArray(obj)) return obj.map(convertBigIntToNumber);
  if (typeof obj === 'object') {
    const converted: any = {};
    for (const key in obj) {
      converted[key] = convertBigIntToNumber(obj[key]);
    }
    return converted;
  }
  return obj;
}

// GET /api/dashboard/stats - Get dashboard statistics
export async function GET(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole();

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const last7DaysStart = subDays(now, 6);
    const last6MonthsStart = subMonths(monthStart, 5);

    // Fetch all statistics in parallel with error handling
    let results;
    try {
      results = await Promise.all([
      // Total patients
      prisma.patient.count({
        where: { isActive: true, hospitalId },
      }),

      // New patients this month
      prisma.patient.count({
        where: {
          isActive: true,
          hospitalId,
          createdAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      }),

      // Today's appointments
      prisma.appointment.count({
        where: {
          hospitalId,
          scheduledDate: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
      }),

      // This month's appointments
      prisma.appointment.count({
        where: {
          hospitalId,
          scheduledDate: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      }),

      // Pending appointments (upcoming)
      prisma.appointment.count({
        where: {
          hospitalId,
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
          scheduledDate: {
            gte: now,
          },
        },
      }),

      // Completed appointments today
      prisma.appointment.count({
        where: {
          hospitalId,
          status: 'COMPLETED',
          scheduledDate: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
      }),

      // This month's revenue
      prisma.payment.aggregate({
        where: {
          hospitalId,
          createdAt: {
            gte: monthStart,
            lte: monthEnd,
          },
          status: 'COMPLETED',
        },
        _sum: {
          amount: true,
        },
      }),

      // Today's revenue
      prisma.payment.aggregate({
        where: {
          hospitalId,
          createdAt: {
            gte: todayStart,
            lte: todayEnd,
          },
          status: 'COMPLETED',
        },
        _sum: {
          amount: true,
        },
      }),

      // Pending payments
      prisma.invoice.aggregate({
        where: {
          hospitalId,
          status: { in: ['PENDING', 'PARTIALLY_PAID'] },
        },
        _sum: {
          totalAmount: true,
        },
      }),

      // Total revenue (all time)
      prisma.payment.aggregate({
        where: {
          hospitalId,
          status: 'COMPLETED',
        },
        _sum: {
          amount: true,
        },
      }),

      // Last 7 days revenue (daily breakdown)
      prisma.$queryRaw`
        SELECT
          DATE(createdAt) as date,
          CAST(COALESCE(SUM(amount), 0) AS DECIMAL(10,2)) as revenue
        FROM \`Payment\`
        WHERE createdAt >= ${last7DaysStart}
        AND status = 'COMPLETED'
        AND hospitalId = ${hospitalId}
        GROUP BY DATE(createdAt)
        ORDER BY date ASC
      `,

      // Last 6 months revenue (monthly breakdown)
      prisma.$queryRaw`
        SELECT
          DATE_FORMAT(createdAt, '%Y-%m') as month,
          CAST(COALESCE(SUM(amount), 0) AS DECIMAL(10,2)) as revenue
        FROM \`Payment\`
        WHERE createdAt >= ${last6MonthsStart}
        AND status = 'COMPLETED'
        AND hospitalId = ${hospitalId}
        GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
        ORDER BY month ASC
      `,

      // Appointments by status
      prisma.appointment.groupBy({
        by: ['status'],
        _count: {
          status: true,
        },
        where: {
          hospitalId,
          scheduledDate: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      }),

      // Top 5 procedures this month
      prisma.$queryRaw`
        SELECT
          p.name,
          CAST(COUNT(*) AS UNSIGNED) as count,
          CAST(COALESCE(SUM(t.cost), 0) AS DECIMAL(10,2)) as revenue
        FROM \`Treatment\` t
        JOIN \`Procedure\` p ON t.procedureId = p.id
        WHERE t.createdAt >= ${monthStart}
        AND t.createdAt <= ${monthEnd}
        AND t.hospitalId = ${hospitalId}
        GROUP BY p.id, p.name
        ORDER BY count DESC
        LIMIT 5
      `,

      // Recent appointments (next 5)
      prisma.appointment.findMany({
        where: {
          hospitalId,
          scheduledDate: {
            gte: now,
          },
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
        },
        include: {
          patient: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          doctor: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          scheduledDate: 'asc',
        },
        take: 5,
      }),

      // Low stock items (using raw query to compare fields)
      prisma.$queryRaw`
        SELECT
          id,
          name,
          CAST(currentStock AS SIGNED) as currentStock,
          CAST(minimumStock AS SIGNED) as minimumStock,
          unit
        FROM \`InventoryItem\`
        WHERE currentStock <= minimumStock
        AND minimumStock > 0
        AND isActive = true
        AND hospitalId = ${hospitalId}
        ORDER BY (minimumStock - currentStock) DESC
        LIMIT 10
      `,
    ]);
    } catch (queryError: any) {
      console.error('Database query error:', {
        message: queryError.message,
        stack: queryError.stack,
        code: queryError.code,
      });
      throw new Error(`Database query failed: ${queryError.message}`);
    }

    // Destructure results and convert BigInt values
    const [
      totalPatients,
      newPatientsThisMonth,
      todayAppointments,
      thisMonthAppointments,
      pendingAppointments,
      completedAppointmentsToday,
      thisMonthRevenue,
      todayRevenue,
      pendingPayments,
      totalRevenue,
      rawLast7DaysRevenue,
      rawLast6MonthsRevenue,
      appointmentsByStatus,
      rawTopProcedures,
      recentAppointments,
      rawLowStockItems,
    ] = results;

    // Convert BigInt values from raw SQL queries
    const last7DaysRevenue = convertBigIntToNumber(rawLast7DaysRevenue);
    const last6MonthsRevenue = convertBigIntToNumber(rawLast6MonthsRevenue);
    const topProcedures = convertBigIntToNumber(rawTopProcedures);
    const lowStockItems = convertBigIntToNumber(rawLowStockItems);

    // Calculate growth percentages
    const prevMonthStart = subMonths(monthStart, 1);
    const prevMonthEnd = subDays(monthStart, 1);

    const [prevMonthRevenue, prevMonthPatients, prevMonthAppointments] = await Promise.all([
      prisma.payment.aggregate({
        where: {
          hospitalId,
          createdAt: {
            gte: prevMonthStart,
            lte: prevMonthEnd,
          },
          status: 'COMPLETED',
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.patient.count({
        where: {
          isActive: true,
          hospitalId,
          createdAt: {
            gte: prevMonthStart,
            lte: prevMonthEnd,
          },
        },
      }),
      prisma.appointment.count({
        where: {
          hospitalId,
          scheduledDate: {
            gte: prevMonthStart,
            lte: prevMonthEnd,
          },
        },
      }),
    ]);

    const revenueGrowth = prevMonthRevenue._sum.amount
      ? ((Number(thisMonthRevenue._sum.amount || 0) - Number(prevMonthRevenue._sum.amount)) / Number(prevMonthRevenue._sum.amount)) * 100
      : 0;

    const patientGrowth = prevMonthPatients
      ? ((newPatientsThisMonth - prevMonthPatients) / prevMonthPatients) * 100
      : 0;

    const appointmentGrowth = prevMonthAppointments
      ? ((thisMonthAppointments - prevMonthAppointments) / prevMonthAppointments) * 100
      : 0;

    // Format response
    const stats = {
      overview: {
        totalPatients,
        newPatientsThisMonth,
        patientGrowth: parseFloat(patientGrowth.toFixed(1)),
        todayAppointments,
        thisMonthAppointments,
        appointmentGrowth: parseFloat(appointmentGrowth.toFixed(1)),
        pendingAppointments,
        completedAppointmentsToday,
        thisMonthRevenue: Number(thisMonthRevenue._sum.amount || 0),
        todayRevenue: Number(todayRevenue._sum.amount || 0),
        revenueGrowth: parseFloat(revenueGrowth.toFixed(1)),
        pendingPayments: Number(pendingPayments._sum.totalAmount || 0),
        totalRevenue: Number(totalRevenue._sum.amount || 0),
      },
      charts: {
        last7DaysRevenue,
        last6MonthsRevenue,
        appointmentsByStatus: appointmentsByStatus.map((item: any) => ({
          status: item.status,
          count: item._count.status,
        })),
        topProcedures,
      },
      recentActivity: {
        upcomingAppointments: recentAppointments.map((apt: any) => ({
          id: apt.id,
          patientName: `${apt.patient.firstName} ${apt.patient.lastName}`,
          doctorName: apt.doctor ? `${apt.doctor.firstName} ${apt.doctor.lastName}` : 'Not assigned',
          date: apt.scheduledDate,
          type: apt.appointmentType,
          status: apt.status,
        })),
        lowStockItems,
      },
    };

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('Dashboard stats error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      meta: error.meta,
    });
    return NextResponse.json(
      {
        error: 'Failed to fetch dashboard statistics',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
