import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// GET - Get today's attendance summary
export async function GET(request: NextRequest) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) { return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get all active staff with today's attendance
    const staff = await prisma.staff.findMany({
      where: { isActive: true, hospitalId },
      include: {
        user: {
          select: {
            role: true
          }
        },
        attendance: {
          where: {
            date: today
          },
          take: 1
        }
      },
      orderBy: { firstName: 'asc' }
    })

    // Calculate summary
    const summary = {
      total: staff.length,
      present: 0,
      absent: 0,
      late: 0,
      halfDay: 0,
      onLeave: 0,
      notMarked: 0
    }

    const staffWithAttendance = staff.map(s => {
      const todayAttendance = s.attendance[0]

      if (!todayAttendance) {
        summary.notMarked++
        return {
          ...s,
          todayStatus: null,
          clockIn: null,
          clockOut: null
        }
      }

      switch (todayAttendance.status) {
        case 'PRESENT':
          summary.present++
          break
        case 'ABSENT':
          summary.absent++
          break
        case 'LATE':
          summary.late++
          break
        case 'HALF_DAY':
          summary.halfDay++
          break
        case 'ON_LEAVE':
          summary.onLeave++
          break
      }

      return {
        ...s,
        todayStatus: todayAttendance.status,
        clockIn: todayAttendance.clockIn,
        clockOut: todayAttendance.clockOut,
        attendanceNotes: todayAttendance.notes
      }
    })

    return NextResponse.json({
      date: today.toISOString().split('T')[0],
      summary,
      staff: staffWithAttendance
    })
  } catch (error) {
    console.error("Error fetching today's attendance:", error)
    return NextResponse.json(
      { error: "Failed to fetch today's attendance" },
      { status: 500 }
    )
  }
}
