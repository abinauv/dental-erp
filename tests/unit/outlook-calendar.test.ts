import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockFetch = vi.hoisted(() => vi.fn())
vi.stubGlobal('fetch', mockFetch)
vi.mock('@/lib/prisma', () => ({ default: prisma }))

const {
  getAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  listCalendars,
  createCalendarEvent,
  deleteCalendarEvent,
  syncAppointments,
} = await import('@/lib/services/outlook-calendar')

describe('Outlook Calendar Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    vi.stubEnv('OUTLOOK_CALENDAR_CLIENT_ID', 'test-client-id')
    vi.stubEnv('OUTLOOK_CALENDAR_CLIENT_SECRET', 'test-secret')
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000')
  })

  describe('getAuthUrl', () => {
    it('generates OAuth2 authorization URL with correct params', () => {
      const url = getAuthUrl('test-state-123')
      expect(url).toContain('login.microsoftonline.com')
      expect(url).toContain('client_id=test-client-id')
      expect(url).toContain('state=test-state-123')
      expect(url).toContain('response_type=code')
      expect(url).toContain('prompt=consent')
      // offline_access yields a refresh token; Calendars.ReadWrite is the sync scope.
      expect(url).toContain('offline_access')
      expect(url).toContain('Calendars.ReadWrite')
    })

    it('includes redirect URI based on NEXTAUTH_URL', () => {
      const url = getAuthUrl('state')
      expect(url).toContain(
        encodeURIComponent('http://localhost:3000/api/integrations/outlook-calendar/callback')
      )
    })
  })

  describe('exchangeCodeForTokens', () => {
    it('exchanges auth code for tokens', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'access-123',
            refresh_token: 'refresh-456',
            expires_in: 3600,
          }),
      })

      const tokens = await exchangeCodeForTokens('auth-code-xyz')
      expect(tokens.access_token).toBe('access-123')
      expect(tokens.refresh_token).toBe('refresh-456')
      expect(tokens.expires_in).toBe(3600)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('login.microsoftonline.com/common/oauth2/v2.0/token'),
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('throws on failed token exchange', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('invalid_grant'),
      })

      await expect(exchangeCodeForTokens('bad-code')).rejects.toThrow('Token exchange failed')
    })
  })

  describe('refreshAccessToken', () => {
    it('refreshes an expired token', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: 'new-token', expires_in: 3600 }),
      })

      const result = await refreshAccessToken('refresh-token-123')
      expect(result.access_token).toBe('new-token')
    })

    it('throws on refresh failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('token_revoked'),
      })

      await expect(refreshAccessToken('bad-refresh')).rejects.toThrow('Token refresh failed')
    })
  })

  describe('listCalendars', () => {
    it('returns calendar list from the Graph value array', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            value: [{ id: 'cal-1', name: 'Calendar', isDefaultCalendar: true }],
          }),
      })

      const calendars = await listCalendars('access-token')
      expect(calendars).toHaveLength(1)
      expect(calendars[0].id).toBe('cal-1')
    })

    it('throws on API failure', async () => {
      mockFetch.mockResolvedValue({ ok: false })

      await expect(listCalendars('bad-token')).rejects.toThrow('Failed to list calendars')
    })
  })

  describe('createCalendarEvent', () => {
    it('creates event from appointment data on a named calendar', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'event-123' }),
      })

      const result = await createCalendarEvent('token', 'cal-1', {
        id: 'apt-1',
        scheduledDate: new Date('2026-03-10'),
        scheduledTime: '10:00',
        duration: 30,
        patientName: 'John Doe',
        doctorName: 'Dr. Smith',
        chiefComplaint: 'Toothache',
        appointmentType: 'CONSULTATION',
      })

      expect(result.eventId).toBe('event-123')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/me/calendars/cal-1/events'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('John Doe'),
        })
      )
    })

    it('targets the default calendar (/me/events) when no calendar id is given', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'event-def-cal' }),
      })

      await createCalendarEvent('token', null, {
        id: 'apt-1',
        scheduledDate: '2026-03-10',
        scheduledTime: '10:00',
        duration: 30,
        patientName: 'Jane Roe',
        doctorName: 'Dr. A',
        chiefComplaint: null,
        appointmentType: 'CHECKUP',
      })

      expect(mockFetch.mock.calls[0][0]).toContain('/me/events')
      expect(mockFetch.mock.calls[0][0]).not.toContain('/calendars/')
    })

    it('throws on API failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('quota exceeded'),
      })

      await expect(
        createCalendarEvent('token', null, {
          id: 'apt-1',
          scheduledDate: '2026-03-10',
          scheduledTime: '10:00',
          duration: 30,
          patientName: 'John',
          doctorName: 'Dr. A',
          chiefComplaint: null,
          appointmentType: 'CHECKUP',
        })
      ).rejects.toThrow('Failed to create calendar event')
    })

    it('uses the given clinic timezone with a floating local time', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'event-tz' }),
      })

      await createCalendarEvent(
        'token',
        'cal-1',
        {
          id: 'apt-1',
          scheduledDate: '2026-03-10',
          scheduledTime: '10:00',
          duration: 30,
          patientName: 'John Doe',
          doctorName: 'Dr. Smith',
          chiefComplaint: null,
          appointmentType: 'CONSULTATION',
        },
        'America/New_York'
      )

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.start.timeZone).toBe('America/New_York')
      expect(body.end.timeZone).toBe('America/New_York')
      // Floating local wall-clock time (no UTC 'Z'), interpreted in the zone.
      expect(body.start.dateTime).toBe('2026-03-10T10:00:00')
      expect(body.end.dateTime).toBe('2026-03-10T10:30:00')
    })

    it('defaults to Asia/Kolkata when no timezone is given', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'event-def' }),
      })

      await createCalendarEvent('token', 'cal-1', {
        id: 'apt-1',
        scheduledDate: '2026-03-10',
        scheduledTime: '09:15',
        duration: 60,
        patientName: 'John',
        doctorName: 'Dr. A',
        chiefComplaint: null,
        appointmentType: 'CHECKUP',
      })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.start.timeZone).toBe('Asia/Kolkata')
      expect(body.start.dateTime).toBe('2026-03-10T09:15:00')
      expect(body.end.dateTime).toBe('2026-03-10T10:15:00')
    })
  })

  describe('deleteCalendarEvent', () => {
    it('deletes an event', async () => {
      mockFetch.mockResolvedValue({ ok: true })

      await deleteCalendarEvent('token', 'cal-1', 'event-123')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/me/calendars/cal-1/events/event-123'),
        expect.objectContaining({ method: 'DELETE' })
      )
    })

    it('succeeds silently for 404/410 (already deleted)', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 })
      await expect(deleteCalendarEvent('token', null, 'gone')).resolves.toBeUndefined()

      mockFetch.mockResolvedValue({ ok: false, status: 410 })
      await expect(deleteCalendarEvent('token', null, 'gone')).resolves.toBeUndefined()
    })

    it('throws for other errors', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 })
      await expect(deleteCalendarEvent('token', null, 'ev')).rejects.toThrow('Failed to delete')
    })
  })

  describe('syncAppointments', () => {
    it('syncs upcoming appointments to Outlook Calendar', async () => {
      ;(prisma.calendarIntegration.findUnique as any).mockResolvedValue({
        id: 'int-1',
        accessToken: 'token',
        refreshToken: 'refresh',
        syncEnabled: true,
        calendarId: 'cal-1',
      })

      // Token validation check (first fetch) succeeds
      mockFetch.mockResolvedValueOnce({ ok: true })

      ;(prisma.user.findUnique as any).mockResolvedValue({
        id: 'user-1',
        staff: { id: 'staff-1' },
      })

      ;(prisma.appointment.findMany as any).mockResolvedValue([
        {
          id: 'apt-1',
          scheduledDate: new Date('2026-03-10'),
          scheduledTime: '10:00',
          duration: 30,
          chiefComplaint: 'Checkup',
          appointmentType: 'REGULAR',
          patient: { firstName: 'John', lastName: 'Doe' },
          doctor: { firstName: 'Alice', lastName: 'Brown' },
        },
      ])

      // createCalendarEvent fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'event-1' }),
      })

      ;(prisma.calendarIntegration.update as any).mockResolvedValue({})

      const result = await syncAppointments('int-1', 'hospital-1', 'user-1')
      expect(result.synced).toBe(1)
      expect(result.errors).toBe(0)
      expect(prisma.calendarIntegration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lastSyncAt: expect.any(Date) }),
        })
      )
    })

    it('throws when integration not found or disabled', async () => {
      ;(prisma.calendarIntegration.findUnique as any).mockResolvedValue(null)
      await expect(syncAppointments('int-x', 'h1', 'u1')).rejects.toThrow('not found or disabled')

      ;(prisma.calendarIntegration.findUnique as any).mockResolvedValue({
        id: 'int-2',
        syncEnabled: false,
      })
      await expect(syncAppointments('int-2', 'h1', 'u1')).rejects.toThrow('not found or disabled')
    })

    it('throws when user has no staff record', async () => {
      ;(prisma.calendarIntegration.findUnique as any).mockResolvedValue({
        id: 'int-1',
        accessToken: 'token',
        refreshToken: 'refresh',
        syncEnabled: true,
      })
      mockFetch.mockResolvedValueOnce({ ok: true })
      ;(prisma.user.findUnique as any).mockResolvedValue({ id: 'user-1', staff: null })

      await expect(syncAppointments('int-1', 'h1', 'user-1')).rejects.toThrow('no staff record')
    })
  })
})
