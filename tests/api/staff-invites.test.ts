import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
  checkStaffLimit: vi.fn(),
  generateToken: vi.fn(),
}))

const mockEmailHelpers = vi.hoisted(() => ({
  sendInviteEmail: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))
vi.mock('@/lib/email-helpers', () => mockEmailHelpers)
vi.mock('@prisma/client', () => ({
  Role: { ADMIN: 'ADMIN', DOCTOR: 'DOCTOR', RECEPTIONIST: 'RECEPTIONIST', LAB_TECH: 'LAB_TECH', ACCOUNTANT: 'ACCOUNTANT' },
  StaffInviteStatus: { PENDING: 'PENDING', ACCEPTED: 'ACCEPTED', EXPIRED: 'EXPIRED', CANCELLED: 'CANCELLED' },
}))

const invitesListModule = await import('@/app/api/staff-invites/route')
const inviteDetailModule = await import('@/app/api/staff-invites/[id]/route')

function makeListRequest(method: string, body?: any) {
  return new Request('http://localhost/api/staff-invites', {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  }) as any
}

function makeDetailRequest(method: string, body?: any) {
  return new Request('http://localhost/api/staff-invites/inv-1', {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  }) as any
}

const detailCtx = { params: Promise.resolve({ id: 'inv-1' }) }

describe('Staff Invites API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      user: { id: 'admin-1', name: 'Admin User' },
      session: { user: { id: 'admin-1', role: 'ADMIN' } },
    })
    mockAuth.checkStaffLimit.mockResolvedValue({ allowed: true, current: 3, max: 10 })
    mockAuth.generateToken.mockReturnValue('mock-token-abc123')
    mockEmailHelpers.sendInviteEmail.mockResolvedValue(true)
  })

  // ─── GET /api/staff-invites ───────────────────────
  describe('GET /api/staff-invites', () => {
    it('returns all invites for the hospital', async () => {
      ;(prisma.staffInvite.findMany as any).mockResolvedValue([
        { id: 'inv-1', email: 'doc@clinic.com', name: 'Dr John', role: 'DOCTOR', status: 'PENDING' },
        { id: 'inv-2', email: 'rec@clinic.com', name: 'Jane', role: 'RECEPTIONIST', status: 'ACCEPTED' },
      ])

      const res = await invitesListModule.GET()
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.invites).toHaveLength(2)
    })

    it('returns 401 when not authenticated', async () => {
      mockAuth.requireAuthAndRole.mockResolvedValue({
        error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
        hospitalId: null,
      })

      const res = await invitesListModule.GET()
      expect(res.status).toBe(401)
    })
  })

  // ─── POST /api/staff-invites ──────────────────────
  describe('POST /api/staff-invites', () => {
    it('creates a new invite and sends email', async () => {
      ;(prisma.user.findFirst as any).mockResolvedValue(null)
      ;(prisma.staffInvite.findFirst as any).mockResolvedValue(null)
      ;(prisma.staffInvite.create as any).mockResolvedValue({
        id: 'inv-new',
        email: 'newdoc@clinic.com',
        name: 'New Doc',
        role: 'DOCTOR',
        expiresAt: new Date(),
      })
      ;(prisma.hospital.findUnique as any).mockResolvedValue({ name: 'Test Clinic' })

      const res = await invitesListModule.POST(
        makeListRequest('POST', { email: 'newdoc@clinic.com', name: 'New Doc', role: 'DOCTOR' })
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.emailSent).toBe(true)
      expect(mockEmailHelpers.sendInviteEmail).toHaveBeenCalled()
    })

    it('returns 400 for invalid email', async () => {
      const res = await invitesListModule.POST(
        makeListRequest('POST', { email: 'bad-email', name: 'Test', role: 'DOCTOR' })
      )
      expect(res.status).toBe(400)
    })

    it('returns 400 for invalid role', async () => {
      const res = await invitesListModule.POST(
        makeListRequest('POST', { email: 'test@test.com', name: 'Test', role: 'SUPERADMIN' })
      )
      expect(res.status).toBe(400)
    })

    it('returns 403 when staff limit reached', async () => {
      mockAuth.checkStaffLimit.mockResolvedValue({ allowed: false, current: 10, max: 10 })

      const res = await invitesListModule.POST(
        makeListRequest('POST', { email: 'test@test.com', name: 'Test', role: 'DOCTOR' })
      )
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toContain('limit')
    })

    it('returns 409 when user already exists', async () => {
      ;(prisma.user.findFirst as any).mockResolvedValue({ id: 'existing-user' })

      const res = await invitesListModule.POST(
        makeListRequest('POST', { email: 'existing@clinic.com', name: 'Existing', role: 'DOCTOR' })
      )
      expect(res.status).toBe(409)
    })

    it('returns 409 when pending invite exists', async () => {
      ;(prisma.user.findFirst as any).mockResolvedValue(null)
      ;(prisma.staffInvite.findFirst as any).mockResolvedValue({ id: 'inv-pending' })

      const res = await invitesListModule.POST(
        makeListRequest('POST', { email: 'pending@clinic.com', name: 'Pending', role: 'DOCTOR' })
      )
      expect(res.status).toBe(409)
    })
  })

  // ─── DELETE /api/staff-invites/[id] ───────────────
  describe('DELETE /api/staff-invites/[id]', () => {
    it('cancels a pending invite', async () => {
      ;(prisma.staffInvite.findUnique as any).mockResolvedValue({
        id: 'inv-1',
        hospitalId: 'hospital-1',
        status: 'PENDING',
      })
      ;(prisma.staffInvite.update as any).mockResolvedValue({})

      const res = await inviteDetailModule.DELETE(makeDetailRequest('DELETE'), detailCtx)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })

    it('returns 400 when trying to cancel non-pending invite', async () => {
      ;(prisma.staffInvite.findUnique as any).mockResolvedValue({
        id: 'inv-1',
        hospitalId: 'hospital-1',
        status: 'ACCEPTED',
      })

      const res = await inviteDetailModule.DELETE(makeDetailRequest('DELETE'), detailCtx)
      expect(res.status).toBe(400)
    })

    it('returns 404 when invite not found', async () => {
      ;(prisma.staffInvite.findUnique as any).mockResolvedValue(null)

      const res = await inviteDetailModule.DELETE(makeDetailRequest('DELETE'), detailCtx)
      expect(res.status).toBe(404)
    })

    it('returns 404 when invite belongs to different hospital', async () => {
      ;(prisma.staffInvite.findUnique as any).mockResolvedValue({
        id: 'inv-1',
        hospitalId: 'other-hospital',
        status: 'PENDING',
      })

      const res = await inviteDetailModule.DELETE(makeDetailRequest('DELETE'), detailCtx)
      expect(res.status).toBe(404)
    })
  })

  // ─── POST /api/staff-invites/[id] (resend) ───────
  describe('POST /api/staff-invites/[id] (resend)', () => {
    it('resends an invite and extends expiry', async () => {
      ;(prisma.staffInvite.findUnique as any).mockResolvedValue({
        id: 'inv-1',
        hospitalId: 'hospital-1',
        status: 'PENDING',
        email: 'doc@clinic.com',
        name: 'Dr John',
        role: 'DOCTOR',
        token: 'old-token',
        invitedBy: 'admin-1',
      })
      ;(prisma.staffInvite.update as any).mockResolvedValue({})
      ;(prisma.hospital.findUnique as any).mockResolvedValue({ name: 'Test Clinic' })
      ;(prisma.user.findUnique as any).mockResolvedValue({ name: 'Admin User' })

      const res = await inviteDetailModule.POST(makeDetailRequest('POST'), detailCtx)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.emailSent).toBe(true)
      expect(prisma.staffInvite.update).toHaveBeenCalled()
    })

    it('returns 400 when trying to resend non-pending invite', async () => {
      ;(prisma.staffInvite.findUnique as any).mockResolvedValue({
        id: 'inv-1',
        hospitalId: 'hospital-1',
        status: 'CANCELLED',
      })

      const res = await inviteDetailModule.POST(makeDetailRequest('POST'), detailCtx)
      expect(res.status).toBe(400)
    })

    it('returns 404 when invite not found', async () => {
      ;(prisma.staffInvite.findUnique as any).mockResolvedValue(null)

      const res = await inviteDetailModule.POST(makeDetailRequest('POST'), detailCtx)
      expect(res.status).toBe(404)
    })
  })
})
