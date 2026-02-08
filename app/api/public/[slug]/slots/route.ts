import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET: Public slot availability by hospital slug.
 * Query params: doctorId, date, duration (optional, default 30)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { searchParams } = new URL(req.url)
    const doctorId = searchParams.get("doctorId")
    const date = searchParams.get("date")
    const duration = parseInt(searchParams.get("duration") || "30")

    if (!doctorId || !date) {
      return NextResponse.json(
        { error: "doctorId and date are required" },
        { status: 400 }
      )
    }

    const hospital = await prisma.hospital.findUnique({
      where: { slug },
      select: { id: true, workingHours: true, patientPortalEnabled: true },
    })

    if (!hospital) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 })
    }

    if (!hospital.patientPortalEnabled) {
      return NextResponse.json(
        { error: "Online booking is not enabled" },
        { status: 403 }
      )
    }

    const hospitalId = hospital.id

    // Parse working hours
    let workingHours = { start: "09:00", end: "21:00", lunchStart: "13:00", lunchEnd: "14:00" }
    if (hospital.workingHours) {
      try { workingHours = JSON.parse(hospital.workingHours) } catch { /* use defaults */ }
    }

    const dateObj = new Date(date)

    // Check holiday
    const holiday = await prisma.holiday.findFirst({
      where: { hospitalId, date: dateObj },
    })
    if (holiday) {
      return NextResponse.json({
        available: false,
        reason: `Holiday: ${holiday.name}`,
        slots: [],
      })
    }

    // Verify doctor
    const doctor = await prisma.staff.findFirst({
      where: { id: doctorId, hospitalId },
    })
    if (!doctor) {
      return NextResponse.json({ error: "Doctor not found" }, { status: 404 })
    }

    // Doctor's shift
    const dayOfWeek = dateObj.getDay()
    const doctorShift = await prisma.staffShift.findUnique({
      where: { staffId_dayOfWeek: { staffId: doctorId, dayOfWeek } },
    })

    // Existing appointments
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        hospitalId,
        doctorId,
        scheduledDate: dateObj,
        status: { notIn: ["CANCELLED", "NO_SHOW", "RESCHEDULED"] },
      },
      select: { scheduledTime: true, duration: true },
    })

    // Generate slots
    const slots: { time: string; available: boolean }[] = []

    const startHour = parseInt(doctorShift?.startTime?.split(":")[0] || workingHours.start.split(":")[0])
    const startMin = parseInt(doctorShift?.startTime?.split(":")[1] || workingHours.start.split(":")[1])
    const endHour = parseInt(doctorShift?.endTime?.split(":")[0] || workingHours.end.split(":")[0])
    const endMin = parseInt(doctorShift?.endTime?.split(":")[1] || workingHours.end.split(":")[1])
    const lunchStartHour = parseInt(workingHours.lunchStart.split(":")[0])
    const lunchStartMin = parseInt(workingHours.lunchStart.split(":")[1])
    const lunchEndHour = parseInt(workingHours.lunchEnd.split(":")[0])
    const lunchEndMin = parseInt(workingHours.lunchEnd.split(":")[1])

    let h = startHour
    let m = startMin

    while (h < endHour || (h === endHour && m < endMin)) {
      const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`

      const isLunch =
        (h > lunchStartHour || (h === lunchStartHour && m >= lunchStartMin)) &&
        (h < lunchEndHour || (h === lunchEndHour && m < lunchEndMin))

      const isBooked = existingAppointments.some((apt) => {
        const [ah, am] = apt.scheduledTime.split(":").map(Number)
        const aptStart = ah * 60 + am
        const aptEnd = aptStart + apt.duration
        const slotStart = h * 60 + m
        const slotEnd = slotStart + duration
        return slotStart < aptEnd && slotEnd > aptStart
      })

      const now = new Date()
      const isToday = dateObj.toDateString() === now.toDateString()
      const isPast = isToday && (h < now.getHours() || (h === now.getHours() && m <= now.getMinutes()))

      slots.push({ time: timeStr, available: !isLunch && !isBooked && !isPast })

      m += 30
      if (m >= 60) { h += 1; m = 0 }
    }

    return NextResponse.json({ available: true, date, doctorId, slots })
  } catch (err: unknown) {
    console.error("Public slots error:", err)
    return NextResponse.json(
      { error: "Failed to fetch slots" },
      { status: 500 }
    )
  }
}
