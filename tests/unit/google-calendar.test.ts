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
} = await import('@/lib/services/google-calendar')

describe('Google Calendar Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    vi.stubEnv('GOOGLE_CALENDAR_CLIENT_ID', 'test-client-id')
    vi.stubEnv('GOOGLE_CALENDAR_CLIENT_SECRET', 'test-secret')
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000')
  })

  describe('getAuthUrl', () => {
    it('generates OAuth2 authorization URL with correct params', () => {
      const url = getAuthUrl('test-state-123')
      expect(url).toContain('accounts.google.com/o/oauth2')
      expect(url).toContain('client_id=test-client-id')
      expect(url).toContain('state=test-state-123')
      expect(url).toContain('response_type=code')
      expect(url).toContain('access_type=offline')
      expect(url).toContain('prompt=consent')
      expect(url).toContain('calendar')
    })

    it('includes redirect URI based on NEXTAUTH_URL', () => {
      const url = getAuthUrl('state')
      expect(url).toContain(encodeURIComponent('http://localhost:3000/api/integrations/google-calendar/callback'))
    })
  })

  describe('exchangeCodeForTokens', () => {
    it('exchanges auth code for tokens', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
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
        expect.stringContaining('oauth2.googleapis.com/token'),
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
    it('returns calendar list', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          items: [{ id: 'primary', summary: 'My Calendar' }],
        }),
      })

      const calendars = await listCalendars('access-token')
      expect(calendars).toHaveLength(1)
      expect(calendars[0].id).toBe('primary')
    })

    it('throws on API failure', async () => {
      mockFetch.mockResolvedValue({ ok: false })

      await expect(listCalendars('bad-token')).rejects.toThrow('Failed to list calendars')
    })
  })

  describe('createCalendarEvent', () => {
    it('creates event from appointment data', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'event-123' }),
      })

      const result = await createCalendarEvent('token', 'primary', {
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
        expect.stringContaining('/calendars/primary/events'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('John Doe'),
        })
      )
    })

    it('throws on API failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('quota exceeded'),
      })

      await expect(
        createCalendarEvent('token', 'primary', {
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
  })

  describe('deleteCalendarEvent', () => {
    it('deletes an event', async () => {
      mockFetch.mockResolvedValue({ ok: true })

      await deleteCalendarEvent('token', 'primary', 'event-123')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/events/event-123'),
        expect.objectContaining({ method: 'DELETE' })
      )
    })

    it('succeeds silently for 404/410 (already deleted)', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 })
      await expect(deleteCalendarEvent('token', 'cal', 'gone')).resolves.toBeUndefined()

      mockFetch.mockResolvedValue({ ok: false, status: 410 })
      await expect(deleteCalendarEvent('token', 'cal', 'gone')).resolves.toBeUndefined()
    })

    it('throws for other errors', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 })
      await expect(deleteCalendarEvent('token', 'cal', 'ev')).rejects.toThrow('Failed to delete')
    })
  })

  describe('syncAppointments', () => {
    it('syncs upcoming appointments to Google Calendar', async () => {
      ;(prisma.calendarIntegration.findUnique as any).mockResolvedValue({
        id: 'int-1',
        accessToken: 'token',
        refreshToken: 'refresh',
        syncEnabled: true,
        calendarId: 'primary',
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
