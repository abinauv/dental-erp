// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2a$10$hashedpassword'),
  },
}))

vi.mock('@/lib/api-helpers', () => ({
  generateUniqueSlug: vi.fn().mockResolvedValue('test-dental-clinic'),
  generateToken: vi.fn().mockReturnValue('mock-verification-token-abc123'),
  PLAN_LIMITS: {
    FREE: { patientLimit: 100, staffLimit: 5, storageLimitMb: 500 },
    PROFESSIONAL: { patientLimit: 1000, staffLimit: 25, storageLimitMb: 5000 },
  },
}))

vi.mock('@/lib/email-helpers', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(true),
}))

vi.mock('@prisma/client', () => ({
  Plan: { FREE: 'FREE', PROFESSIONAL: 'PROFESSIONAL', ENTERPRISE: 'ENTERPRISE' },
  Role: { ADMIN: 'ADMIN', DOCTOR: 'DOCTOR', STAFF: 'STAFF' },
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { POST as signupPOST } from '@/app/api/public/signup/route'
import {
  POST as verifyPOST,
  GET as verifyGET,
} from '@/app/api/public/verify-email/route'
import { prisma } from '@/lib/prisma'
import { sendVerificationEmail } from '@/lib/email-helpers'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(path: string, method = 'POST', body?: any): Request {
  const url = `http://localhost${path}`
  const init: any = { method }
  if (body) {
    init.body = JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  return new Request(url, init)
}

const validSignup = {
  hospitalName: 'Test Dental Clinic',
  adminName: 'John Doe',
  email: 'admin@testdental.com',
  phone: '9876543210',
  password: 'secureP@ss123',
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. POST /api/public/signup
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/public/signup', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 for validation errors', async () => {
    const res = await signupPOST(makeReq('/api/public/signup', 'POST', {
      hospitalName: 'A', // too short
      adminName: '',
      email: 'invalid',
      phone: '123',
      password: 'short',
    }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Validation failed')
    expect(body.details).toBeDefined()
  })

  it('returns 400 for missing fields', async () => {
    const res = await signupPOST(makeReq('/api/public/signup', 'POST', {
      hospitalName: 'Test',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 409 when email already exists', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u1', email: 'admin@testdental.com' } as any)

    const res = await signupPOST(makeReq('/api/public/signup', 'POST', validSignup))
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toContain('already exists')
  })

  it('creates hospital, user, and staff in transaction', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const mockTx = {
      hospital: {
        create: vi.fn().mockResolvedValue({ id: 'h1', slug: 'test-dental-clinic' }),
      },
      user: {
        create: vi.fn().mockResolvedValue({ id: 'u1', email: 'admin@testdental.com' }),
      },
    }
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => fn(mockTx as any))

    const res = await signupPOST(makeReq('/api/public/signup', 'POST', validSignup))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.hospitalId).toBe('h1')
    expect(body.emailSent).toBe(true)

    // Verify hospital created with FREE plan
    expect(mockTx.hospital.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Test Dental Clinic',
          plan: 'FREE',
          isActive: true,
        }),
      })
    )

    // Verify user created with ADMIN role and staff record
    expect(mockTx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'admin@testdental.com',
          role: 'ADMIN',
          isHospitalAdmin: true,
          staff: {
            create: expect.objectContaining({
              employeeId: 'EMP001',
              firstName: 'John',
            }),
          },
        }),
      })
    )
  })

  it('handles email sending failure gracefully', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(sendVerificationEmail).mockResolvedValue(false)

    const mockTx = {
      hospital: { create: vi.fn().mockResolvedValue({ id: 'h1' }) },
      user: { create: vi.fn().mockResolvedValue({ id: 'u1' }) },
    }
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => fn(mockTx as any))

    const res = await signupPOST(makeReq('/api/public/signup', 'POST', validSignup))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.emailSent).toBe(false)
    expect(body.message).toContain('SMTP')
  })

  it('returns 500 on unexpected error', async () => {
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('DB down'))

    const res = await signupPOST(makeReq('/api/public/signup', 'POST', validSignup))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toContain('error occurred during signup')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. POST /api/public/verify-email
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/public/verify-email', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 for missing token', async () => {
    const res = await verifyPOST(makeReq('/api/public/verify-email', 'POST', {}))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Invalid token')
  })

  it('returns 400 for invalid/expired token', async () => {
    vi.mocked(prisma.hospital.findFirst).mockResolvedValue(null)

    const res = await verifyPOST(makeReq('/api/public/verify-email', 'POST', {
      token: 'expired-token-xyz',
    }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('Invalid or expired')
  })

  it('verifies email and clears token', async () => {
    vi.mocked(prisma.hospital.findFirst).mockResolvedValue({
      id: 'h1',
      slug: 'test-dental',
      emailVerificationToken: 'valid-token',
    } as any)
    vi.mocked(prisma.hospital.update).mockResolvedValue({} as any)

    const res = await verifyPOST(makeReq('/api/public/verify-email', 'POST', {
      token: 'valid-token',
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.hospitalSlug).toBe('test-dental')
    expect(prisma.hospital.update).toHaveBeenCalledWith({
      where: { id: 'h1' },
      data: {
        emailVerificationToken: null,
        emailVerificationExpiry: null,
      },
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. GET /api/public/verify-email
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/public/verify-email', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when token is missing', async () => {
    const res = await verifyGET(new Request('http://localhost/api/public/verify-email'))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Token is required')
  })

  it('returns valid=false for invalid token', async () => {
    vi.mocked(prisma.hospital.findFirst).mockResolvedValue(null)

    const res = await verifyGET(new Request('http://localhost/api/public/verify-email?token=bad'))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.valid).toBe(false)
  })

  it('returns hospital info for valid token', async () => {
    vi.mocked(prisma.hospital.findFirst).mockResolvedValue({
      id: 'h1',
      name: 'Test Dental',
      email: 'admin@test.com',
    } as any)

    const res = await verifyGET(new Request('http://localhost/api/public/verify-email?token=valid-token'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.valid).toBe(true)
    expect(body.hospitalName).toBe('Test Dental')
    expect(body.email).toBe('admin@test.com')
  })
})
