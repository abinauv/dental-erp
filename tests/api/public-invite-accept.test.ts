import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))
vi.mock('@prisma/client', () => ({
  StaffInviteStatus: { PENDING: 'PENDING', ACCEPTED: 'ACCEPTED', EXPIRED: 'EXPIRED', CANCELLED: 'CANCELLED' },
  Role: { ADMIN: 'ADMIN', DOCTOR: 'DOCTOR', RECEPTIONIST: 'RECEPTIONIST', STAFF: 'STAFF' },
}))
vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed-password') },
}))

const mod = await import('@/app/api/public/invite/accept/route')

function makePostRequest(body: any) {
  return new Request('http://localhost/api/public/invite/accept', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as any
}

function makeGetRequest(token?: string) {
  const url = new URL('http://localhost/api/public/invite/accept')
  if (token) url.searchParams.set('token', token)
  return new Request(url.toString()) as any
}

const validInvite = {
  id: 'invite-1',
  email: 'jane@example.com',
  name: 'Jane Smith',
  role: 'DOCTOR',
  token: 'valid-token-123',
  status: 'PENDING',
  hospitalId: 'hospital-1',
  expiresAt: new Date(Date.now() + 86400000), // +1 day
  hospital: { id: 'hospital-1', name: 'Test Clinic', isActive: true },
}

describe('POST /api/public/invite/accept', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accepts invite and creates user + staff in transaction', async () => {
    ;(prisma.staffInvite.findUnique as any).mockResolvedValue(validInvite)
    ;(prisma.user.findUnique as any).mockResolvedValue(null) // no existing user
    ;(prisma.staff.count as any).mockResolvedValue(5)
    // $transaction mock already delegates to callback
    ;(prisma.user.create as any).mockResolvedValue({ id: 'user-new' })
    ;(prisma.staffInvite.update as any).mockResolvedValue({})

    const res = await mod.POST(makePostRequest({
      token: 'valid-token-123',
      password: 'SecurePass123!',
      phone: '9876543210',
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.hospitalName).toBe('Test Clinic')
  })

  it('returns 400 for Zod validation failure', async () => {
    const res = await mod.POST(makePostRequest({
      token: '',
      password: 'short',
      phone: '123',
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Validation failed')
  })

  it('returns 400 for invalid token', async () => {
    ;(prisma.staffInvite.findUnique as any).mockResolvedValue(null)

    const res = await mod.POST(makePostRequest({
      token: 'invalid-token',
      password: 'SecurePass123!',
      phone: '9876543210',
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid invite token')
  })

  it('returns 400 when invite already used', async () => {
    ;(prisma.staffInvite.findUnique as any).mockResolvedValue({
      ...validInvite,
      status: 'ACCEPTED',
    })

    const res = await mod.POST(makePostRequest({
      token: 'valid-token-123',
      password: 'SecurePass123!',
      phone: '9876543210',
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('already been used')
  })

  it('returns 400 and marks as EXPIRED when invite expired', async () => {
    ;(prisma.staffInvite.findUnique as any).mockResolvedValue({
      ...validInvite,
      expiresAt: new Date(Date.now() - 86400000), // -1 day
    })
    ;(prisma.staffInvite.update as any).mockResolvedValue({})

    const res = await mod.POST(makePostRequest({
      token: 'valid-token-123',
      password: 'SecurePass123!',
      phone: '9876543210',
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('expired')
    expect(prisma.staffInvite.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'EXPIRED' } })
    )
  })

  it('returns 400 when hospital is inactive', async () => {
    ;(prisma.staffInvite.findUnique as any).mockResolvedValue({
      ...validInvite,
      hospital: { ...validInvite.hospital, isActive: false },
    })

    const res = await mod.POST(makePostRequest({
      token: 'valid-token-123',
      password: 'SecurePass123!',
      phone: '9876543210',
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('no longer active')
  })

  it('returns 409 when email already exists', async () => {
    ;(prisma.staffInvite.findUnique as any).mockResolvedValue(validInvite)
    ;(prisma.user.findUnique as any).mockResolvedValue({ id: 'existing-user' })

    const res = await mod.POST(makePostRequest({
      token: 'valid-token-123',
      password: 'SecurePass123!',
      phone: '9876543210',
    }))
    expect(res.status).toBe(409)
  })
})

describe('GET /api/public/invite/accept', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('validates a valid token and returns invite details', async () => {
    ;(prisma.staffInvite.findUnique as any).mockResolvedValue({
      ...validInvite,
      hospital: { name: 'Test Clinic', isActive: true },
    })

    const res = await mod.GET(makeGetRequest('valid-token-123'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.valid).toBe(true)
    expect(body.invite.email).toBe('jane@example.com')
    expect(body.invite.hospitalName).toBe('Test Clinic')
  })

  it('returns 400 when token query param missing', async () => {
    const res = await mod.GET(makeGetRequest())
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid token', async () => {
    ;(prisma.staffInvite.findUnique as any).mockResolvedValue(null)

    const res = await mod.GET(makeGetRequest('bad-token'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.valid).toBe(false)
  })

  it('returns 400 for non-PENDING invite', async () => {
    ;(prisma.staffInvite.findUnique as any).mockResolvedValue({
      ...validInvite,
      status: 'ACCEPTED',
      hospital: { name: 'Test Clinic', isActive: true },
    })

    const res = await mod.GET(makeGetRequest('valid-token-123'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.valid).toBe(false)
  })

  it('returns 400 for expired invite', async () => {
    ;(prisma.staffInvite.findUnique as any).mockResolvedValue({
      ...validInvite,
      expiresAt: new Date(Date.now() - 86400000),
      hospital: { name: 'Test Clinic', isActive: true },
    })

    const res = await mod.GET(makeGetRequest('valid-token-123'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.valid).toBe(false)
    expect(body.error).toContain('expired')
  })

  it('returns 400 when hospital inactive', async () => {
    ;(prisma.staffInvite.findUnique as any).mockResolvedValue({
      ...validInvite,
      hospital: { name: 'Test Clinic', isActive: false },
    })

    const res = await mod.GET(makeGetRequest('valid-token-123'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.valid).toBe(false)
    expect(body.error).toContain('no longer active')
  })
})
