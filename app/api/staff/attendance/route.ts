import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// GET - Get attendance records with filters
export async function GET(request: NextRequest) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) { return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  try {
    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get("staffId")
    const date = searchParams.get("date")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const status = searchParams.get("status")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")

    const skip = (page - 1) * limit

    const where: any = {
      staff: { hospitalId }
    }

    if (staffId) {
      where.staffId = staffId
    }

    if (date) {
      where.date = new Date(date)
    } else if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    } else if (startDate) {
      where.date = {
        gte: new Date(startDate)
      }
    } else if (endDate) {
      where.date = {
        lte: new Date(endDate)
      }
    }

    if (status && status !== "all") {
      where.status = status
    }

    const [attendance, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          staff: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              user: {
                select: {
                  role: true
                }
              }
            }
          }
        },
        orderBy: [
          { date: 'desc' },
          { clockIn: 'desc' }
        ],
        skip,
        take: limit
      }),
      prisma.attendance.count({ where })
    ])

    return NextResponse.json({
      attendance,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("Error fetching attendance:", error)
    return NextResponse.json(
      { error: "Failed to fetch attendance records" },
      { status: 500 }
    )
  }
}

// POST - Mark attendance for a staff member
export async function POST(request: NextRequest) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) { return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  try {
    const body = await request.json()
    const { staffId, date, status, clockIn, clockOut, notes } = body

    if (!staffId || !date || !status) {
      return NextResponse.json(
        { error: "Missing required fields: staffId, date, status" },
        { status: 400 }
      )
    }

    // Verify staff belongs to the same hospital
    const staffMember = await prisma.staff.findFirst({
      where: { id: staffId, hospitalId }
    })
    if (!staffMember) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 })
    }

    // Check if attendance already exists for this date
    const attendanceDate = new Date(date)
    attendanceDate.setHours(0, 0, 0, 0)

    const existingAttendance = await prisma.attendance.findUnique({
      where: {
        staffId_date: {
          staffId,
          date: attendanceDate
        }
      }
    })

    if (existingAttendance) {
      // Update existing attendance
      const updated = await prisma.attendance.update({
        where: { id: existingAttendance.id },
        data: {
          status,
          clockIn: clockIn ? new Date(clockIn) : existingAttendance.clockIn,
          clockOut: clockOut ? new Date(clockOut) : existingAttendance.clockOut,
          notes
        },
        include: {
          staff: {
            select: {
              employeeId: true,
              firstName: true,
              lastName: true
            }
          }
        }
      })
      return NextResponse.json(updated)
    }

    // Create new attendance record
    const attendance = await prisma.attendance.create({
      data: {
        hospitalId,
        staffId,
        date: attendanceDate,
        status,
        clockIn: clockIn ? new Date(clockIn) : null,
        clockOut: clockOut ? new Date(clockOut) : null,
        notes
      },
      include: {
        staff: {
          select: {
            employeeId: true,
            firstName: true,
            lastName: true
          }
        }
      }
    })

    return NextResponse.json(attendance, { status: 201 })
  } catch (error) {
    console.error("Error marking attendance:", error)
    return NextResponse.json(
      { error: "Failed to mark attendance" },
      { status: 500 }
    )
  }
}
