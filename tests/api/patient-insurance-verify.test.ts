import { describe, it, expect, vi, beforeEach } from 'vitest'
import prisma from '@/tests/__mocks__/prisma'

const mockAuth = vi.hoisted(() => ({
  requireAuthAndRole: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => mockAuth)
vi.mock('@/lib/prisma', () => ({ prisma, default: prisma }))

const mod = await import('@/app/api/patients/[id]/insurance/verify/route')

function makeRequest(body: any) {
  return new Request('http://localhost/api/patients/p1/insurance/verify', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as any
}

describe('POST /api/patients/[id]/insurance/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: null,
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1', role: 'ADMIN' } },
    })
  })

  it('verifies an insurance policy', async () => {
    ;(prisma.patientInsurance.updateMany as any).mockResolvedValue({ count: 1 })

    const ctx = { params: Promise.resolve({ id: 'p1' }) }
    const res = await mod.POST(makeRequest({ policyId: 'policy-1' }), ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.verifiedAt).toBeDefined()
    expect(prisma.patientInsurance.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'policy-1', hospitalId: 'hospital-1', patientId: 'p1' },
        data: expect.objectContaining({ verificationStatus: 'VERIFIED' }),
      })
    )
  })

  it('returns 400 when policyId missing', async () => {
    const ctx = { params: Promise.resolve({ id: 'p1' }) }
    const res = await mod.POST(makeRequest({}), ctx)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Policy ID')
  })

  it('returns 404 when policy not found', async () => {
    ;(prisma.patientInsurance.updateMany as any).mockResolvedValue({ count: 0 })

    const ctx = { params: Promise.resolve({ id: 'p1' }) }
    const res = await mod.POST(makeRequest({ policyId: 'no-exist' }), ctx)
    expect(res.status).toBe(404)
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.requireAuthAndRole.mockResolvedValue({
      error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
      hospitalId: null,
    })

    const ctx = { params: Promise.resolve({ id: 'p1' }) }
    const res = await mod.POST(makeRequest({ policyId: 'policy-1' }), ctx)
    expect(res.status).toBe(401)
  })
})
