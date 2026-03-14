import prisma from "@/lib/prisma"

// Google Calendar OAuth2 and sync service
// Uses Google Calendar API v3 via REST (no googleapis package needed)

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
]

function getClientId() {
  return process.env.GOOGLE_CALENDAR_CLIENT_ID || ""
}

function getClientSecret() {
  return process.env.GOOGLE_CALENDAR_CLIENT_SECRET || ""
}

function getRedirectUri() {
  const base = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  return `${base}/api/integrations/google-calendar/callback`
}

/** Generate the OAuth2 authorization URL */
export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

/** Exchange authorization code for tokens */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
}> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  return response.json()
}

/** Refresh an expired access token */
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string
  expires_in: number
}> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      grant_type: "refresh_token",
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token refresh failed: ${error}`)
  }

  return response.json()
}

/** Get a valid access token, refreshing if needed */
async function getValidAccessToken(integration: {
  id: string
  accessToken: string
  refreshToken: string
}): Promise<string> {
  // Try existing token first
  const testResponse = await fetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList?maxResults=1`, {
    headers: { Authorization: `Bearer ${integration.accessToken}` },
  })

  if (testResponse.ok) {
    return integration.accessToken
  }

  // Refresh the token
  const tokens = await refreshAccessToken(integration.refreshToken)

  await prisma.calendarIntegration.update({
    where: { id: integration.id },
    data: { accessToken: tokens.access_token },
  })

  return tokens.access_token
}

/** List user's calendars */
export async function listCalendars(accessToken: string): Promise<any[]> {
  const response = await fetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) throw new Error("Failed to list calendars")
  const data = await response.json()
  return data.items || []
}

/** Create a Google Calendar event from an appointment */
export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  appointment: {
    id: string
    scheduledDate: Date | string
    scheduledTime: string
    duration: number
    patientName: string
    doctorName: string
    chiefComplaint?: string | null
    appointmentType: string
  }
): Promise<{ eventId: string }> {
  const date = typeof appointment.scheduledDate === "string"
    ? appointment.scheduledDate.split("T")[0]
    : appointment.scheduledDate.toISOString().split("T")[0]

  const [hours, minutes] = appointment.scheduledTime.split(":").map(Number)
  const startDateTime = new Date(`${date}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`)
  const endDateTime = new Date(startDateTime.getTime() + appointment.duration * 60 * 1000)

  const event = {
    summary: `Dental Appointment - ${appointment.patientName}`,
    description: [
      `Patient: ${appointment.patientName}`,
      `Doctor: ${appointment.doctorName}`,
      `Type: ${appointment.appointmentType}`,
      appointment.chiefComplaint ? `Chief Complaint: ${appointment.chiefComplaint}` : "",
      `\nManaged by DentalERP`,
    ].filter(Boolean).join("\n"),
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: "Asia/Kolkata",
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: "Asia/Kolkata",
    },
    extendedProperties: {
      private: {
        dentalErpAppointmentId: appointment.id,
      },
    },
  }

  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create calendar event: ${error}`)
  }

  const data = await response.json()
  return { eventId: data.id }
}

/** Delete a Google Calendar event */
export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  // 404 or 410 means it's already deleted
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    throw new Error("Failed to delete calendar event")
  }
}

/** Sync recent appointments to Google Calendar for a user */
export async function syncAppointments(
  integrationId: string,
  hospitalId: string,
  userId: string
): Promise<{ synced: number; errors: number }> {
  const integration = await prisma.calendarIntegration.findUnique({
    where: { id: integrationId },
  })

  if (!integration || !integration.syncEnabled) {
    throw new Error("Calendar integration not found or disabled")
  }

  const accessToken = await getValidAccessToken({
    id: integration.id,
    accessToken: integration.accessToken,
    refreshToken: integration.refreshToken,
  })

  const calendarId = integration.calendarId || "primary"

  // Get the user's staff record to find their doctor ID
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { staff: true },
  })

  if (!user?.staff) {
    throw new Error("User has no staff record")
  }

  // Get upcoming appointments for this doctor
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const appointments = await prisma.appointment.findMany({
    where: {
      hospitalId,
      doctorId: user.staff.id,
      scheduledDate: { gte: today },
      status: { in: ["SCHEDULED", "CONFIRMED"] },
    },
    include: {
      patient: {
        select: { firstName: true, lastName: true },
      },
      doctor: {
        select: { firstName: true, lastName: true },
      },
    },
    take: 50,
    orderBy: { scheduledDate: "asc" },
  })

  let synced = 0
  let errors = 0

  for (const appt of appointments) {
    try {
      await createCalendarEvent(accessToken, calendarId, {
        id: appt.id,
        scheduledDate: appt.scheduledDate,
        scheduledTime: appt.scheduledTime,
        duration: appt.duration,
        patientName: `${appt.patient.firstName} ${appt.patient.lastName}`,
        doctorName: `Dr. ${appt.doctor.firstName} ${appt.doctor.lastName}`,
        chiefComplaint: appt.chiefComplaint,
        appointmentType: appt.appointmentType,
      })
      synced++
    } catch {
      errors++
    }
  }

  // Update last sync time
  await prisma.calendarIntegration.update({
    where: { id: integrationId },
    data: { lastSyncAt: new Date() },
  })

  return { synced, errors }
}
