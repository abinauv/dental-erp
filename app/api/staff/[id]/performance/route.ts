import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// GET - Get staff member's performance statistics
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) { return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    // Default to current month if no dates provided
    const now = new Date()
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const start = startDate ? new Date(startDate) : defaultStart
    const end = endDate ? new Date(endDate) : defaultEnd

    // Get staff info - scoped to hospital
    const staff = await prisma.staff.findFirst({
      where: { id, hospitalId },
      include: {
        user: {
          select: {
            role: true
          }
        }
      }
    })

    if (!staff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 })
    }

    // Get appointments stats
    const appointments = await prisma.appointment.findMany({
      where: {
        hospitalId,
        doctorId: id,
        scheduledDate: {
          gte: start,
          lte: end
        }
      },
      select: {
        id: true,
        status: true,
        scheduledDate: true,
        waitTime: true
      }
    })

    const appointmentStats = {
      total: appointments.length,
      completed: appointments.filter(a => a.status === 'COMPLETED').length,
      cancelled: appointments.filter(a => a.status === 'CANCELLED').length,
      noShow: appointments.filter(a => a.status === 'NO_SHOW').length,
      avgWaitTime: 0
    }

    const completedWithWaitTime = appointments.filter(a => a.status === 'COMPLETED' && a.waitTime)
    if (completedWithWaitTime.length > 0) {
      appointmentStats.avgWaitTime = Math.round(
        completedWithWaitTime.reduce((sum, a) => sum + (a.waitTime || 0), 0) / completedWithWaitTime.length
      )
    }

    // Get treatments stats
    const treatments = await prisma.treatment.findMany({
      where: {
        hospitalId,
        doctorId: id,
        createdAt: {
          gte: start,
          lte: end
        }
      },
      select: {
        id: true,
        status: true,
        cost: true,
        procedure: {
          select: {
            category: true,
            name: true
          }
        }
      }
    })

    const treatmentStats = {
      total: treatments.length,
      completed: treatments.filter(t => t.status === 'COMPLETED').length,
      inProgress: treatments.filter(t => t.status === 'IN_PROGRESS').length,
      cancelled: treatments.filter(t => t.status === 'CANCELLED').length
    }

    // Revenue calculation
    const completedTreatments = treatments.filter(t => t.status === 'COMPLETED')
    const totalRevenue = completedTreatments.reduce((sum, t) => sum + Number(t.cost), 0)

    // Procedure breakdown
    const procedureBreakdown: Record<string, { count: number; revenue: number }> = {}
    completedTreatments.forEach(t => {
      const category = t.procedure.category
      if (!procedureBreakdown[category]) {
        procedureBreakdown[category] = { count: 0, revenue: 0 }
      }
      procedureBreakdown[category].count++
      procedureBreakdown[category].revenue += Number(t.cost)
    })

    // Get unique patients treated
    const uniquePatients = await prisma.treatment.groupBy({
      by: ['patientId'],
      where: {
        hospitalId,
        doctorId: id,
        createdAt: {
          gte: start,
          lte: end
        },
        status: 'COMPLETED'
      }
    })

    // Get attendance stats
    const attendance = await prisma.attendance.findMany({
      where: {
        staffId: id,
        staff: { hospitalId },
        date: {
          gte: start,
          lte: end
        }
      }
    })

    const attendanceStats = {
      totalDays: attendance.length,
      present: attendance.filter(a => a.status === 'PRESENT').length,
      absent: attendance.filter(a => a.status === 'ABSENT').length,
      late: attendance.filter(a => a.status === 'LATE').length,
      halfDay: attendance.filter(a => a.status === 'HALF_DAY').length,
      onLeave: attendance.filter(a => a.status === 'ON_LEAVE').length
    }

    // Get prescriptions count
    const prescriptionsCount = await prisma.prescription.count({
      where: {
        hospitalId,
        doctorId: id,
        createdAt: {
          gte: start,
          lte: end
        }
      }
    })

    return NextResponse.json({
      staff: {
        id: staff.id,
        employeeId: staff.employeeId,
        name: `${staff.firstName} ${staff.lastName}`,
        role: staff.user.role,
        specialization: staff.specialization
      },
      period: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      },
      appointments: appointmentStats,
      treatments: treatmentStats,
      revenue: {
        total: totalRevenue,
        averagePerTreatment: completedTreatments.length > 0
          ? Math.round(totalRevenue / completedTreatments.length)
          : 0
      },
      procedureBreakdown: Object.entries(procedureBreakdown).map(([category, data]) => ({
        category,
        ...data
      })),
      patientsTreated: uniquePatients.length,
      prescriptionsWritten: prescriptionsCount,
      attendance: attendanceStats
    })
  } catch (error) {
    console.error("Error fetching performance:", error)
    return NextResponse.json(
      { error: "Failed to fetch performance statistics" },
      { status: 500 }
    )
  }
}
