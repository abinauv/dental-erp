import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.hoisted(() => vi.fn())

vi.stubGlobal('fetch', mockFetch)

describe('Video Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  describe('getVideoProvider', () => {
    it('returns "daily" when DAILY_API_KEY is set', async () => {
      vi.stubEnv('DAILY_API_KEY', 'test-api-key')
      // Re-import to pick up env change
      const { getVideoProvider } = await import('@/lib/services/video.service')
      expect(getVideoProvider()).toBe('daily')
    })

    it('returns "jitsi" when DAILY_API_KEY is not set', async () => {
      vi.stubEnv('DAILY_API_KEY', '')
      const { getVideoProvider } = await import('@/lib/services/video.service')
      expect(getVideoProvider()).toBe('jitsi')
    })
  })

  describe('createRoom', () => {
    it('creates a Daily.co room when API key is available', async () => {
      vi.stubEnv('DAILY_API_KEY', 'test-api-key')
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ url: 'https://test.daily.co/dental-consult-1', name: 'dental-consult-1' }),
      })

      const { createRoom } = await import('@/lib/services/video.service')
      const result = await createRoom('consult-1')
      expect(result.provider).toBe('daily')
      expect(result.roomUrl).toContain('daily.co')
      expect(result.roomName).toContain('consult-1')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/rooms'),
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('creates a Jitsi room URL without API call', async () => {
      vi.stubEnv('DAILY_API_KEY', '')
      const { createRoom } = await import('@/lib/services/video.service')
      const result = await createRoom('consult-2')
      expect(result.provider).toBe('jitsi')
      expect(result.roomUrl).toContain('meet.jit.si')
      expect(result.roomName).toContain('consult-2')
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('deleteRoom', () => {
    it('deletes room via Daily.co API when provider is daily', async () => {
      vi.stubEnv('DAILY_API_KEY', 'test-api-key')
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })

      const { deleteRoom } = await import('@/lib/services/video.service')
      await deleteRoom('dental-consult-1')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/rooms/dental-consult-1'),
        expect.objectContaining({ method: 'DELETE' })
      )
    })

    it('does nothing for Jitsi provider', async () => {
      vi.stubEnv('DAILY_API_KEY', '')
      const { deleteRoom } = await import('@/lib/services/video.service')
      await deleteRoom('some-room')
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('getRoomToken', () => {
    it('generates a meeting token for Daily.co', async () => {
      vi.stubEnv('DAILY_API_KEY', 'test-api-key')
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: 'eyJ-meeting-token' }),
      })

      const { getRoomToken } = await import('@/lib/services/video.service')
      const token = await getRoomToken('dental-room', 'Dr. Smith', true)
      expect(token).toBe('eyJ-meeting-token')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/meeting-tokens'),
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('returns null for Jitsi provider', async () => {
      vi.stubEnv('DAILY_API_KEY', '')
      const { getRoomToken } = await import('@/lib/services/video.service')
      const token = await getRoomToken('dental-room', 'Patient', false)
      expect(token).toBeNull()
    })
  })

  describe('getRoomInfo', () => {
    it('fetches room info from Daily.co', async () => {
      vi.stubEnv('DAILY_API_KEY', 'test-api-key')
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ name: 'room-1', participants: 2 }),
      })

      const { getRoomInfo } = await import('@/lib/services/video.service')
      const info = await getRoomInfo('room-1')
      expect(info).toEqual({ name: 'room-1', participants: 2 })
    })

    it('returns null for Jitsi provider', async () => {
      vi.stubEnv('DAILY_API_KEY', '')
      const { getRoomInfo } = await import('@/lib/services/video.service')
      const info = await getRoomInfo('room-1')
      expect(info).toBeNull()
    })
  })
})
