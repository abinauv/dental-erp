// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => import('../__mocks__/prisma'))

vi.mock('@/lib/patient-auth', () => ({
  generateOTP: vi.fn(() => '123456'),
  createPatientToken: vi.fn(() => Promise.resolve('mock-jwt-token')),
  setPatientCookie: vi.fn((response) => response),
  clearPatientCookie: vi.fn((response) => response),
  requirePatientAuth: vi.fn(),
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { POST as sendOtpPOST } from '@/app/api/patient-portal/auth/send-otp/route'
import { POST as verifyOtpPOST } from '@/app/api/patient-portal/auth/verify-otp/route'
import { POST as logoutPOST } from '@/app/api/patient-portal/auth/logout/route'
import { GET as dashboardGET } from '@/app/api/patient-portal/dashboard/route'
import { requirePatientAuth } from '@/lib/patient-auth'
import { prisma } from '@/lib/prisma'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(path: string, method = 'POST', body?: any): NextRequest {
  const url = `http://localhost${path}`
  const init: any = { method }
  if (body) {
    init.body = JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  return new NextRequest(url, init)
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. POST /api/patient-portal/auth/send-otp
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/patient-portal/auth/send-otp', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when phone or hospitalSlug missing', async () => {
    const res = await sendOtpPOST(makeReq('/api/patient-portal/auth/send-otp', 'POST', { phone: '9876543210' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('required')
  })

  it('returns 404 when hospital not found', async () => {
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue(null)

    const res = await sendOtpPOST(makeReq('/api/patient-portal/auth/send-otp', 'POST', {
      phone: '9876543210',
      hospitalSlug: 'nonexistent-clinic',
    }))
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toContain('Clinic not found')
  })

  it('returns 403 when portal disabled', async () => {
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue({
      id: 'h1', name: 'Test Clinic', patientPortalEnabled: false,
    } as any)

    const res = await sendOtpPOST(makeReq('/api/patient-portal/auth/send-otp', 'POST', {
      phone: '9876543210',
      hospitalSlug: 'test-clinic',
    }))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toContain('not enabled')
  })

  it('returns 404 when patient not found', async () => {
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue({
      id: 'h1', name: 'Test Clinic', patientPortalEnabled: true,
    } as any)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)

    const res = await sendOtpPOST(makeReq('/api/patient-portal/auth/send-otp', 'POST', {
      phone: '9876543210',
      hospitalSlug: 'test-clinic',
    }))
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toContain('No patient account')
  })

  it('returns 429 when rate limited (5+ OTPs in 10 min)', async () => {
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue({
      id: 'h1', name: 'Test Clinic', patientPortalEnabled: true,
    } as any)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1', firstName: 'John' } as any)
    vi.mocked(prisma.patientOTP.count).mockResolvedValue(5)

    const res = await sendOtpPOST(makeReq('/api/patient-portal/auth/send-otp', 'POST', {
      phone: '9876543210',
      hospitalSlug: 'test-clinic',
    }))
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body.error).toContain('Too many OTP')
  })

  it('sends OTP successfully', async () => {
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue({
      id: 'h1', name: 'Test Clinic', patientPortalEnabled: true,
    } as any)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1', firstName: 'John' } as any)
    vi.mocked(prisma.patientOTP.count).mockResolvedValue(0)
    vi.mocked(prisma.patientOTP.create).mockResolvedValue({} as any)

    const res = await sendOtpPOST(makeReq('/api/patient-portal/auth/send-otp', 'POST', {
      phone: '9876543210',
      hospitalSlug: 'test-clinic',
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(prisma.patientOTP.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          hospitalId: 'h1',
          phone: '9876543210',
          otp: '123456',
        }),
      })
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. POST /api/patient-portal/auth/verify-otp
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/patient-portal/auth/verify-otp', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when fields missing', async () => {
    const res = await verifyOtpPOST(makeReq('/api/patient-portal/auth/verify-otp', 'POST', {
      phone: '9876543210',
    }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('required')
  })

  it('returns 404 when hospital not found', async () => {
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue(null)

    const res = await verifyOtpPOST(makeReq('/api/patient-portal/auth/verify-otp', 'POST', {
      phone: '9876543210',
      otp: '123456',
      hospitalSlug: 'nonexistent',
    }))

    expect(res.status).toBe(404)
  })

  it('returns 400 when OTP expired or not found', async () => {
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue({ id: 'h1', name: 'Clinic' } as any)
    vi.mocked(prisma.patientOTP.findFirst).mockResolvedValue(null)

    const res = await verifyOtpPOST(makeReq('/api/patient-portal/auth/verify-otp', 'POST', {
      phone: '9876543210',
      otp: '999999',
      hospitalSlug: 'test-clinic',
    }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('expired')
  })

  it('returns 429 when max attempts exceeded', async () => {
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue({ id: 'h1', name: 'Clinic' } as any)
    vi.mocked(prisma.patientOTP.findFirst).mockResolvedValue({
      id: 'otp1', otp: '123456', attempts: 3, verified: false,
    } as any)

    const res = await verifyOtpPOST(makeReq('/api/patient-portal/auth/verify-otp', 'POST', {
      phone: '9876543210',
      otp: '123456',
      hospitalSlug: 'test-clinic',
    }))

    expect(res.status).toBe(429)
  })

  it('increments attempts on wrong OTP', async () => {
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue({ id: 'h1', name: 'Clinic' } as any)
    vi.mocked(prisma.patientOTP.findFirst).mockResolvedValue({
      id: 'otp1', otp: '123456', attempts: 1, verified: false,
    } as any)
    vi.mocked(prisma.patientOTP.update).mockResolvedValue({} as any)

    const res = await verifyOtpPOST(makeReq('/api/patient-portal/auth/verify-otp', 'POST', {
      phone: '9876543210',
      otp: '999999',
      hospitalSlug: 'test-clinic',
    }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('Invalid OTP')
    expect(prisma.patientOTP.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { attempts: { increment: 1 } },
      })
    )
  })

  it('verifies OTP and returns patient data', async () => {
    vi.mocked(prisma.hospital.findUnique).mockResolvedValue({ id: 'h1', name: 'Clinic' } as any)
    vi.mocked(prisma.patientOTP.findFirst).mockResolvedValue({
      id: 'otp1', otp: '123456', attempts: 0, verified: false,
    } as any)
    vi.mocked(prisma.patientOTP.update).mockResolvedValue({} as any)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({
      id: 'p1', hospitalId: 'h1', patientId: 'PT001',
      firstName: 'John', lastName: 'Doe', phone: '9876543210', email: 'john@example.com',
    } as any)

    const res = await verifyOtpPOST(makeReq('/api/patient-portal/auth/verify-otp', 'POST', {
      phone: '9876543210',
      otp: '123456',
      hospitalSlug: 'test-clinic',
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.patient.name).toBe('John Doe')
    expect(body.patient.patientId).toBe('PT001')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. POST /api/patient-portal/auth/logout
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/patient-portal/auth/logout', () => {
  beforeEach(() => vi.clearAllMocks())

  it('clears patient cookie', async () => {
    const res = await logoutPOST(makeReq('/api/patient-portal/auth/logout', 'POST'))
    const body = await res.json()

    expect(res.status).toBe(200)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. GET /api/patient-portal/dashboard
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/patient-portal/dashboard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(requirePatientAuth).mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      patient: null,
    } as any)

    const res = await dashboardGET(makeReq('/api/patient-portal/dashboard', 'GET'))
    expect(res.status).toBe(401)
  })

  it('returns dashboard data with stats', async () => {
    vi.mocked(requirePatientAuth).mockResolvedValue({
      error: null,
      patient: { id: 'p1', hospitalId: 'h1' },
    } as any)

    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { id: 'a1', scheduledDate: new Date('2026-03-01'), status: 'SCHEDULED', doctor: { firstName: 'Dr', lastName: 'Smith', specialization: 'General' } },
    ] as any)
    vi.mocked(prisma.treatment.findMany).mockResolvedValue([
      { id: 't1', procedure: { name: 'Cleaning', code: 'CLN' }, doctor: { firstName: 'Dr', lastName: 'Smith' } },
    ] as any)
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      { id: 'inv1', invoiceNo: 'INV001', totalAmount: 5000, paidAmount: 2000, balanceAmount: 3000, status: 'PARTIALLY_PAID', dueDate: new Date() },
    ] as any)
    vi.mocked(prisma.appointment.count).mockResolvedValue(10) // total visits

    const res = await dashboardGET(makeReq('/api/patient-portal/dashboard', 'GET'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.upcomingAppointments).toHaveLength(1)
    expect(body.recentTreatments).toHaveLength(1)
    expect(body.outstandingInvoices).toHaveLength(1)
    expect(body.stats.totalVisits).toBe(10)
    expect(body.stats.upcomingCount).toBe(1)
    expect(body.stats.totalOutstanding).toBe(3000)
  })

  it('handles empty dashboard data', async () => {
    vi.mocked(requirePatientAuth).mockResolvedValue({
      error: null,
      patient: { id: 'p1', hospitalId: 'h1' },
    } as any)

    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.treatment.findMany).mockResolvedValue([])
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([])
    vi.mocked(prisma.appointment.count).mockResolvedValue(0)

    const res = await dashboardGET(makeReq('/api/patient-portal/dashboard', 'GET'))
    const body = await res.json()

    expect(body.stats.totalVisits).toBe(0)
    expect(body.stats.totalOutstanding).toBe(0)
    expect(body.upcomingAppointments).toHaveLength(0)
  })
})
