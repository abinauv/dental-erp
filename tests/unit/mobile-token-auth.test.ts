import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mobile Bearer tokens are JWTs and can't be revoked, so every request also
// checks that the user and their clinic are still active.

const mockHeaders = vi.hoisted(() => ({ value: new Headers() }))
const mockFindUnique = vi.hoisted(() => vi.fn())
const mockJwtVerify = vi.hoisted(() => vi.fn())

vi.mock('next/headers', () => ({ headers: async () => mockHeaders.value }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn().mockResolvedValue(null) } } }))
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: mockFindUnique } } }))
// Signature checking is jose's job; these tests cover what happens after it.
vi.mock('jose', () => ({ jwtVerify: mockJwtVerify }))

const { getAuthenticatedHospital } = await import('@/lib/api-helpers')

function bearer(sub = 'user-1') {
  mockHeaders.value = new Headers({ authorization: 'Bearer a.valid.jwt' })
  mockJwtVerify.mockResolvedValue({
    payload: { sub, role: 'DOCTOR', hospitalId: 'h1', email: 'd@clinic.test' },
  })
}

describe('getAuthenticatedHospital with a mobile Bearer token', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accepts a valid token for an active user in an active clinic', async () => {
    bearer()
    mockFindUnique.mockResolvedValue({ isActive: true, hospital: { isActive: true } })

    const result = await getAuthenticatedHospital()

    expect(result.error).toBeNull()
    expect(result.hospitalId).toBe('h1')
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } })
    )
  })

  it('rejects a still-valid token once the user is deactivated', async () => {
    bearer()
    mockFindUnique.mockResolvedValue({ isActive: false, hospital: { isActive: true } })

    const result = await getAuthenticatedHospital()

    expect(result.user).toBeNull()
    expect(result.error?.status).toBe(401)
  })

  it('rejects a still-valid token once the clinic is deactivated', async () => {
    bearer()
    mockFindUnique.mockResolvedValue({ isActive: true, hospital: { isActive: false } })

    expect((await getAuthenticatedHospital()).error?.status).toBe(401)
  })

  it('rejects a token for a user that no longer exists', async () => {
    bearer('gone')
    mockFindUnique.mockResolvedValue(null)

    expect((await getAuthenticatedHospital()).error?.status).toBe(401)
  })

  it('rejects a token whose signature does not verify, without a lookup', async () => {
    mockHeaders.value = new Headers({ authorization: 'Bearer forged' })
    mockJwtVerify.mockRejectedValue(new Error('signature verification failed'))

    expect((await getAuthenticatedHospital()).error?.status).toBe(401)
    expect(mockFindUnique).not.toHaveBeenCalled()
  })
})
