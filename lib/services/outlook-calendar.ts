import prisma from '@/lib/prisma'

// Outlook / Microsoft 365 Calendar OAuth2 and sync service.
// Uses the Microsoft Graph v1.0 REST API via fetch (no @microsoft/* package).
// Mirrors lib/services/google-calendar.ts so the two providers behave the same
// from the caller's point of view.

const MS_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
const GRAPH_API = 'https://graph.microsoft.com/v1.0'

// offline_access is what yields a refresh token on the Microsoft identity
// platform (Google uses access_type=offline instead).
const SCOPES = ['offline_access', 'Calendars.ReadWrite', 'User.Read']

// Public "PS_PUBLIC_STRINGS" namespace for a named extended property. Tags each
// event with the originating appointment id, matching the Google provider's
// extendedProperties.private.dentalErpAppointmentId marker.
const APPT_PROP_ID = 'String {00020329-0000-0000-C000-000000000046} Name dentalErpAppointmentId'

function getClientId() {
  return process.env.OUTLOOK_CALENDAR_CLIENT_ID || ''
}

function getClientSecret() {
  return process.env.OUTLOOK_CALENDAR_CLIENT_SECRET || ''
}

function getRedirectUri() {
  const base =
    process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${base}/api/integrations/outlook-calendar/callback`
}

/** Generate the OAuth2 authorization URL */
export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    response_mode: 'query',
    scope: SCOPES.join(' '),
    prompt: 'consent',
    state,
  })
  return `${MS_AUTH_URL}?${params.toString()}`
}

/** Exchange authorization code for tokens */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
}> {
  const response = await fetch(MS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: getRedirectUri(),
      scope: SCOPES.join(' '),
      grant_type: 'authorization_code',
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
  refresh_token?: string
  expires_in: number
}> {
  const response = await fetch(MS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      scope: SCOPES.join(' '),
      grant_type: 'refresh_token',
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
  // Try the existing token first with a cheap authenticated call.
  const testResponse = await fetch(`${GRAPH_API}/me/calendars?$top=1`, {
    headers: { Authorization: `Bearer ${integration.accessToken}` },
  })

  if (testResponse.ok) {
    return integration.accessToken
  }

  // Refresh the token. Microsoft rotates refresh tokens, so persist the new one
  // when the response carries it or the next refresh would fail.
  const tokens = await refreshAccessToken(integration.refreshToken)

  await prisma.calendarIntegration.update({
    where: { id: integration.id },
    data: {
      accessToken: tokens.access_token,
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
    },
  })

  return tokens.access_token
}

/** List the user's calendars */
export async function listCalendars(accessToken: string): Promise<any[]> {
  const response = await fetch(`${GRAPH_API}/me/calendars`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) throw new Error('Failed to list calendars')
  const data = await response.json()
  return data.value || []
}

// A null/empty calendarId targets the user's default calendar (/me/events);
// otherwise events are scoped to the named calendar.
function eventsPath(calendarId?: string | null): string {
  return calendarId ? `/me/calendars/${encodeURIComponent(calendarId)}/events` : '/me/events'
}

/** Create an Outlook Calendar event from an appointment */
export async function createCalendarEvent(
  accessToken: string,
  calendarId: string | null,
  appointment: {
    id: string
    scheduledDate: Date | string
    scheduledTime: string
    duration: number
    patientName: string
    doctorName: string
    chiefComplaint?: string | null
    appointmentType: string
  },
  // The clinic's IANA timezone (Hospital.timezone). The appointment's
  // scheduledTime is a wall-clock time in this zone. Defaults to Asia/Kolkata
  // for backward compatibility with existing Indian clinics. Microsoft Graph
  // accepts IANA zone names directly in the start/end timeZone field.
  timezone: string = 'Asia/Kolkata'
): Promise<{ eventId: string }> {
  const date =
    typeof appointment.scheduledDate === 'string'
      ? appointment.scheduledDate.split('T')[0]
      : appointment.scheduledDate.toISOString().split('T')[0]

  const [hours, minutes] = appointment.scheduledTime.split(':').map(Number)
  const [year, month, day] = date.split('-').map(Number)

  // Build floating local datetimes (no UTC offset) and let Graph interpret them
  // in `timezone`. Using Date.UTC only for the duration arithmetic keeps the
  // wall-clock maths (incl. day rollover) independent of the server's zone.
  const startMs = Date.UTC(year, month - 1, day, hours, minutes, 0)
  const endMs = startMs + appointment.duration * 60 * 1000
  const toLocalString = (ms: number): string => {
    const dt = new Date(ms)
    const pad = (n: number) => String(n).padStart(2, '0')
    return (
      `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}` +
      `T${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}:00`
    )
  }

  const event = {
    subject: `Dental Appointment - ${appointment.patientName}`,
    body: {
      contentType: 'text',
      content: [
        `Patient: ${appointment.patientName}`,
        `Doctor: ${appointment.doctorName}`,
        `Type: ${appointment.appointmentType}`,
        appointment.chiefComplaint ? `Chief Complaint: ${appointment.chiefComplaint}` : '',
        `\nManaged by DentalERP`,
      ]
        .filter(Boolean)
        .join('\n'),
    },
    start: {
      dateTime: toLocalString(startMs),
      timeZone: timezone,
    },
    end: {
      dateTime: toLocalString(endMs),
      timeZone: timezone,
    },
    singleValueExtendedProperties: [
      {
        id: APPT_PROP_ID,
        value: appointment.id,
      },
    ],
  }

  const response = await fetch(`${GRAPH_API}${eventsPath(calendarId)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create calendar event: ${error}`)
  }

  const data = await response.json()
  return { eventId: data.id }
}

/** Delete an Outlook Calendar event */
export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string | null,
  eventId: string
): Promise<void> {
  const response = await fetch(`${GRAPH_API}${eventsPath(calendarId)}/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  // 404 or 410 means it's already deleted.
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    throw new Error('Failed to delete calendar event')
  }
}

/** Sync recent appointments to Outlook Calendar for a user */
export async function syncAppointments(
  integrationId: string,
  hospitalId: string,
  userId: string
): Promise<{ synced: number; errors: number }> {
  const integration = await prisma.calendarIntegration.findUnique({
    where: { id: integrationId },
  })

  if (!integration || !integration.syncEnabled) {
    throw new Error('Calendar integration not found or disabled')
  }

  const accessToken = await getValidAccessToken({
    id: integration.id,
    accessToken: integration.accessToken,
    refreshToken: integration.refreshToken,
  })

  const calendarId = integration.calendarId || null

  // The clinic's timezone, so synced events land at the right wall-clock time
  // for a non-IST clinic rather than defaulting to Asia/Kolkata.
  const hospital = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    select: { timezone: true },
  })
  const clinicTimezone = hospital?.timezone || 'Asia/Kolkata'

  // Get the user's staff record to find their doctor ID.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { staff: true },
  })

  if (!user?.staff) {
    throw new Error('User has no staff record')
  }

  // Get upcoming appointments for this doctor.
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const appointments = await prisma.appointment.findMany({
    where: {
      hospitalId,
      doctorId: user.staff.id,
      scheduledDate: { gte: today },
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
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
    orderBy: { scheduledDate: 'asc' },
  })

  let synced = 0
  let errors = 0

  for (const appt of appointments) {
    try {
      await createCalendarEvent(
        accessToken,
        calendarId,
        {
          id: appt.id,
          scheduledDate: appt.scheduledDate,
          scheduledTime: appt.scheduledTime,
          duration: appt.duration,
          patientName: `${appt.patient.firstName} ${appt.patient.lastName}`,
          doctorName: `Dr. ${appt.doctor.firstName} ${appt.doctor.lastName}`,
          chiefComplaint: appt.chiefComplaint,
          appointmentType: appt.appointmentType,
        },
        clinicTimezone
      )
      synced++
    } catch {
      errors++
    }
  }

  // Update last sync time.
  await prisma.calendarIntegration.update({
    where: { id: integrationId },
    data: { lastSyncAt: new Date() },
  })

  return { synced, errors }
}
