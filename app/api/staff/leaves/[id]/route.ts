import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// GET - Get single leave request details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) { return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  try {
    const { id } = await params

    const leave = await prisma.leave.findFirst({
      where: {
        id,
        staff: { hospitalId }
      },
      include: {
        staff: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            user: {
              select: {
                role: true
              }
            }
          }
        }
      }
    })

    if (!leave) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 })
    }

    return NextResponse.json(leave)
  } catch (error) {
    console.error("Error fetching leave:", error)
    return NextResponse.json(
      { error: "Failed to fetch leave request" },
      { status: 500 }
    )
  }
}

// PATCH - Update leave request (approve/reject/cancel)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) { return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  try {
    const { id } = await params
    const body = await request.json()
    const { status, reason } = body

    const existingLeave = await prisma.leave.findFirst({
      where: {
        id,
        staff: { hospitalId }
      }
    })

    if (!existingLeave) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 })
    }

    // Only admin can approve/reject, staff can only cancel their own
    if (status === 'APPROVED' || status === 'REJECTED') {
      if (session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: "Only admin can approve or reject leaves" }, { status: 403 })
      }
    }

    const updateData: any = {}

    if (status) {
      updateData.status = status
      if (status === 'APPROVED' || status === 'REJECTED') {
        updateData.approvedBy = session.user.staffId
      }
    }

    if (reason !== undefined) {
      updateData.reason = reason
    }

    const updatedLeave = await prisma.leave.update({
      where: { id },
      data: updateData,
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

    // If leave is approved, mark those days as ON_LEAVE in attendance
    if (status === 'APPROVED') {
      const startDate = new Date(existingLeave.startDate)
      const endDate = new Date(existingLeave.endDate)

      const currentDate = new Date(startDate)
      while (currentDate <= endDate) {
        const dateOnly = new Date(currentDate)
        dateOnly.setHours(0, 0, 0, 0)

        await prisma.attendance.upsert({
          where: {
            staffId_date: {
              staffId: existingLeave.staffId,
              date: dateOnly
            }
          },
          update: {
            status: 'ON_LEAVE',
            notes: `Leave: ${existingLeave.leaveType}`
          },
          create: {
            hospitalId,
            staffId: existingLeave.staffId,
            date: dateOnly,
            status: 'ON_LEAVE',
            notes: `Leave: ${existingLeave.leaveType}`
          }
        })

        currentDate.setDate(currentDate.getDate() + 1)
      }
    }

    return NextResponse.json(updatedLeave)
  } catch (error) {
    console.error("Error updating leave:", error)
    return NextResponse.json(
      { error: "Failed to update leave request" },
      { status: 500 }
    )
  }
}

// DELETE - Delete a leave request (only pending ones)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) { return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  try {
    const { id } = await params

    const leave = await prisma.leave.findFirst({
      where: {
        id,
        staff: { hospitalId }
      }
    })

    if (!leave) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 })
    }

    // Can only delete pending leaves
    if (leave.status !== 'PENDING') {
      return NextResponse.json(
        { error: "Can only delete pending leave requests" },
        { status: 400 }
      )
    }

    await prisma.leave.delete({
      where: { id }
    })

    return NextResponse.json({ message: "Leave request deleted successfully" })
  } catch (error) {
    console.error("Error deleting leave:", error)
    return NextResponse.json(
      { error: "Failed to delete leave request" },
      { status: 500 }
    )
  }
}
