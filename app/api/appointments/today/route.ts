import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// GET - Get today's appointments for queue management
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const doctorId = searchParams.get("doctorId") || ""

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const where: any = {
      hospitalId,
      scheduledDate: {
        gte: today,
        lt: tomorrow
      }
    }

    if (doctorId) {
      where.doctorId = doctorId
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          }
        },
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            specialization: true,
          }
        }
      },
      orderBy: [
        { scheduledTime: 'asc' }
      ]
    })

    // Group appointments by status for queue view
    const waiting = appointments.filter(a => a.status === "CHECKED_IN")
    const inProgress = appointments.filter(a => a.status === "IN_PROGRESS")
    const upcoming = appointments.filter(a => ["SCHEDULED", "CONFIRMED"].includes(a.status))
    const completed = appointments.filter(a => a.status === "COMPLETED")
    const noShow = appointments.filter(a => a.status === "NO_SHOW")
    const cancelled = appointments.filter(a => a.status === "CANCELLED")

    // Calculate stats
    const stats = {
      total: appointments.length,
      waiting: waiting.length,
      inProgress: inProgress.length,
      upcoming: upcoming.length,
      completed: completed.length,
      noShow: noShow.length,
      cancelled: cancelled.length,
      avgWaitTime: waiting.length > 0
        ? Math.round(waiting.reduce((acc, a) => acc + (a.waitTime || 0), 0) / waiting.length)
        : 0
    }

    return NextResponse.json({
      appointments,
      queue: {
        waiting,
        inProgress,
        upcoming,
        completed,
        noShow,
        cancelled
      },
      stats
    })
  } catch (error) {
    console.error("Error fetching today's appointments:", error)
    return NextResponse.json(
      { error: "Failed to fetch today's appointments" },
      { status: 500 }
    )
  }
}
