import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePatientAuth } from "@/lib/patient-auth"

/**
 * GET: Available slots for the patient's hospital.
 * Query: doctorId, date
 */
export async function GET(req: NextRequest) {
  const { error, patient } = await requirePatientAuth(req)
  if (error) return error

  try {
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

    const hospitalId = patient!.hospitalId

    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { workingHours: true },
    })

    let workingHours = { start: "09:00", end: "21:00", lunchStart: "13:00", lunchEnd: "14:00" }
    if (hospital?.workingHours) {
      try { workingHours = JSON.parse(hospital.workingHours) } catch { /* defaults */ }
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

    const dayOfWeek = dateObj.getDay()
    const doctorShift = await prisma.staffShift.findUnique({
      where: { staffId_dayOfWeek: { staffId: doctorId, dayOfWeek } },
    })

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        hospitalId,
        doctorId,
        scheduledDate: dateObj,
        status: { notIn: ["CANCELLED", "NO_SHOW", "RESCHEDULED"] },
      },
      select: { scheduledTime: true, duration: true },
    })

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
    console.error("Portal slots error:", err)
    return NextResponse.json(
      { error: "Failed to fetch slots" },
      { status: 500 }
    )
  }
}
