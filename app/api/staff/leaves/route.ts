import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// GET - Get leave requests with filters
export async function GET(request: NextRequest) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) { return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  try {
    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get("staffId")
    const status = searchParams.get("status")
    const leaveType = searchParams.get("leaveType")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")

    const skip = (page - 1) * limit

    const where: any = {
      staff: { hospitalId }
    }

    if (staffId) {
      where.staffId = staffId
    }

    if (status && status !== "all") {
      where.status = status
    }

    if (leaveType && leaveType !== "all") {
      where.leaveType = leaveType
    }

    if (startDate || endDate) {
      where.OR = []
      if (startDate && endDate) {
        // Find leaves that overlap with the date range
        where.OR.push({
          AND: [
            { startDate: { lte: new Date(endDate) } },
            { endDate: { gte: new Date(startDate) } }
          ]
        })
      } else if (startDate) {
        where.OR.push({ endDate: { gte: new Date(startDate) } })
      } else if (endDate) {
        where.OR.push({ startDate: { lte: new Date(endDate) } })
      }
    }

    const [leaves, total] = await Promise.all([
      prisma.leave.findMany({
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
          { createdAt: 'desc' }
        ],
        skip,
        take: limit
      }),
      prisma.leave.count({ where })
    ])

    return NextResponse.json({
      leaves,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("Error fetching leaves:", error)
    return NextResponse.json(
      { error: "Failed to fetch leave requests" },
      { status: 500 }
    )
  }
}

// POST - Create a leave request
export async function POST(request: NextRequest) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) { return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  try {
    const body = await request.json()
    const { staffId, leaveType, startDate, endDate, reason } = body

    if (!staffId || !leaveType || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing required fields: staffId, leaveType, startDate, endDate" },
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

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (end < start) {
      return NextResponse.json(
        { error: "End date must be after start date" },
        { status: 400 }
      )
    }

    // Check for overlapping leaves
    const existingLeave = await prisma.leave.findFirst({
      where: {
        staffId,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          {
            AND: [
              { startDate: { lte: end } },
              { endDate: { gte: start } }
            ]
          }
        ]
      }
    })

    if (existingLeave) {
      return NextResponse.json(
        { error: "There is already a leave request for these dates" },
        { status: 400 }
      )
    }

    const leave = await prisma.leave.create({
      data: {
        staffId,
        leaveType,
        startDate: start,
        endDate: end,
        reason,
        status: 'PENDING'
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

    return NextResponse.json(leave, { status: 201 })
  } catch (error) {
    console.error("Error creating leave:", error)
    return NextResponse.json(
      { error: "Failed to create leave request" },
      { status: 500 }
    )
  }
}
