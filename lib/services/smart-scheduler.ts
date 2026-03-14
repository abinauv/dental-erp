import prisma from "@/lib/prisma"

/**
 * Smart Scheduler Service
 * When an appointment is cancelled, this service finds waitlisted patients
 * who match the freed slot and notifies them.
 */

interface CancelledSlot {
  hospitalId: string
  doctorId: string
  scheduledDate: Date
  scheduledTime: string
  duration: number
}

function getDayOfWeek(date: Date): string {
  const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
  return days[date.getDay()]
}

function getTimeOfDay(time: string): string {
  const hour = parseInt(time.split(":")[0])
  if (hour < 12) return "MORNING"
  if (hour < 17) return "AFTERNOON"
  return "EVENING"
}

/**
 * Find waitlisted patients that match a cancelled appointment slot
 */
export async function findMatchingWaitlistPatients(
  slot: CancelledSlot
): Promise<Array<{
  id: string
  patientId: string
  patientName: string
  patientPhone: string
}>> {
  const dayOfWeek = getDayOfWeek(slot.scheduledDate)
  const timeOfDay = getTimeOfDay(slot.scheduledTime)

  // Find active waitlist entries for this hospital
  const waitlistEntries = await prisma.waitlist.findMany({
    where: {
      hospitalId: slot.hospitalId,
      status: "ACTIVE",
      OR: [
        { doctorId: slot.doctorId },
        { doctorId: null }, // No doctor preference
      ],
    },
    orderBy: { createdAt: "asc" }, // First come, first served
  })

  // Filter by preferred days and time
  const matching = waitlistEntries.filter((entry) => {
    // Check preferred days
    if (entry.preferredDays) {
      const days = entry.preferredDays as string[]
      if (days.length > 0 && !days.includes(dayOfWeek)) {
        return false
      }
    }

    // Check preferred time
    if (entry.preferredTime && entry.preferredTime !== timeOfDay) {
      return false
    }

    return true
  })

  if (matching.length === 0) return []

  // Fetch patient details for matching entries
  const patientIds = matching.map((e) => e.patientId)
  const patients = await prisma.patient.findMany({
    where: {
      id: { in: patientIds },
      hospitalId: slot.hospitalId,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
    },
  })

  const patientMap = new Map(patients.map((p) => [p.id, p]))

  return matching
    .map((entry) => {
      const patient = patientMap.get(entry.patientId)
      if (!patient) return null
      return {
        id: entry.id,
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        patientPhone: patient.phone,
      }
    })
    .filter(Boolean) as Array<{
      id: string
      patientId: string
      patientName: string
      patientPhone: string
    }>
}

/**
 * Process a cancelled appointment — find waitlist matches and mark them as notified
 * Returns the list of patients to notify (caller handles actual SMS sending)
 */
export async function handleCancellationWaitlist(
  slot: CancelledSlot
): Promise<{
  matchedPatients: Array<{
    id: string
    patientId: string
    patientName: string
    patientPhone: string
  }>
  slotDetails: {
    date: string
    time: string
    doctorName: string
  }
}> {
  const matches = await findMatchingWaitlistPatients(slot)

  // Get doctor name for the notification message
  const doctor = await prisma.staff.findUnique({
    where: { id: slot.doctorId },
    select: { firstName: true, lastName: true },
  })

  const doctorName = doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : "your doctor"
  const dateStr = slot.scheduledDate.toLocaleDateString("en-IN", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

  // Mark top matching entries as NOTIFIED (limit to 3 to avoid overbooking)
  const toNotify = matches.slice(0, 3)

  if (toNotify.length > 0) {
    await prisma.waitlist.updateMany({
      where: {
        id: { in: toNotify.map((m) => m.id) },
      },
      data: {
        status: "NOTIFIED",
        notifiedAt: new Date(),
      },
    })
  }

  return {
    matchedPatients: toNotify,
    slotDetails: {
      date: dateStr,
      time: slot.scheduledTime,
      doctorName,
    },
  }
}

/**
 * Book a waitlisted patient into the freed slot
 */
export async function bookFromWaitlist(
  waitlistId: string,
  appointmentId: string
): Promise<void> {
  await prisma.waitlist.update({
    where: { id: waitlistId },
    data: {
      status: "BOOKED",
      bookedAt: new Date(),
    },
  })
}
