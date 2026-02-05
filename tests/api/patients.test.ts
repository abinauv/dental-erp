import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock modules with inline factories - these get hoisted
vi.mock('@/lib/prisma', () => ({
  prisma: {
    patient: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    hospital: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
  checkPatientLimit: vi.fn(),
  requireRole: vi.fn(),
  PLAN_LIMITS: {
    FREE: { patientLimit: 100, staffLimit: 3, storageLimitMb: 500 },
    PROFESSIONAL: { patientLimit: -1, staffLimit: -1, storageLimitMb: -1 },
    ENTERPRISE: { patientLimit: -1, staffLimit: -1, storageLimitMb: -1 },
    SELF_HOSTED: { patientLimit: -1, staffLimit: -1, storageLimitMb: -1 },
  },
}))

// Import after mocks are set up
import { GET, POST } from '@/app/api/patients/route'
import { requireAuthAndRole, checkPatientLimit } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

describe('Patients API - GET /api/patients', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: authenticated user with hospital
    vi.mocked(requireAuthAndRole).mockResolvedValue({
      error: null,
      user: { id: 'user-1', email: 'admin@test.com', role: 'ADMIN' },
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1' } },
    })
  })

  it('should return 401 for unauthenticated requests', async () => {
    vi.mocked(requireAuthAndRole).mockResolvedValue({
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      user: null,
      hospitalId: null,
      session: null,
    })

    const request = new NextRequest('http://localhost:3000/api/patients')
    const response = await GET(request)

    expect(response.status).toBe(401)
  })

  it('should return patients list with pagination', async () => {
    const mockPatients = [
      {
        id: 'patient-1',
        patientId: 'PAT202500001',
        firstName: 'John',
        lastName: 'Doe',
        phone: '9876543210',
        email: 'john@example.com',
        gender: 'MALE',
        age: 35,
        bloodGroup: 'O+',
        city: 'Mumbai',
      },
    ]

    vi.mocked(prisma.patient.findMany).mockResolvedValue(mockPatients as any)
    vi.mocked(prisma.patient.count).mockResolvedValue(1)

    const request = new NextRequest('http://localhost:3000/api/patients?page=1&limit=10')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.patients).toHaveLength(1)
    expect(data.pagination.page).toBe(1)
    expect(data.pagination.limit).toBe(10)
    expect(data.pagination.total).toBe(1)
  })

  it('should support search functionality', async () => {
    vi.mocked(prisma.patient.findMany).mockResolvedValue([])
    vi.mocked(prisma.patient.count).mockResolvedValue(0)

    const request = new NextRequest('http://localhost:3000/api/patients?search=john')
    await GET(request)

    expect(prisma.patient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          hospitalId: 'hospital-1',
          isActive: true,
          OR: expect.arrayContaining([
            expect.objectContaining({ firstName: { contains: 'john' } }),
          ]),
        }),
      })
    )
  })

  it('should handle database errors gracefully', async () => {
    vi.mocked(prisma.patient.findMany).mockRejectedValue(new Error('Database error'))

    const request = new NextRequest('http://localhost:3000/api/patients')
    const response = await GET(request)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('Failed to fetch patients')
  })
})

describe('Patients API - POST /api/patients', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(requireAuthAndRole).mockResolvedValue({
      error: null,
      user: { id: 'user-1', email: 'admin@test.com', role: 'ADMIN' },
      hospitalId: 'hospital-1',
      session: { user: { id: 'user-1' } },
    })

    vi.mocked(checkPatientLimit).mockResolvedValue({
      allowed: true,
      current: 5,
      max: 100,
    })
  })

  it('should return 401 for unauthenticated requests', async () => {
    vi.mocked(requireAuthAndRole).mockResolvedValue({
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      user: null,
      hospitalId: null,
      session: null,
    })

    const request = new NextRequest('http://localhost:3000/api/patients', {
      method: 'POST',
      body: JSON.stringify({ firstName: 'John', lastName: 'Doe', phone: '9876543210' }),
    })
    const response = await POST(request)

    expect(response.status).toBe(401)
  })

  it('should create a patient with valid data', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.patient.create).mockResolvedValue({
      id: 'new-patient-id',
      patientId: 'PAT202500001',
      firstName: 'John',
      lastName: 'Doe',
      phone: '9876543210',
      hospitalId: 'hospital-1',
    } as any)

    const request = new NextRequest('http://localhost:3000/api/patients', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'John',
        lastName: 'Doe',
        phone: '9876543210',
        email: 'john@example.com',
        gender: 'MALE',
        age: 35,
      }),
    })
    const response = await POST(request)

    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.firstName).toBe('John')
  })

  it('should return 400 for missing required fields', async () => {
    const request = new NextRequest('http://localhost:3000/api/patients', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'John',
        // Missing lastName and phone
      }),
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('required')
  })

  it('should return 409 for duplicate phone number', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({
      id: 'existing-patient',
      phone: '9876543210',
    } as any)

    const request = new NextRequest('http://localhost:3000/api/patients', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'John',
        lastName: 'Doe',
        phone: '9876543210',
      }),
    })
    const response = await POST(request)

    expect(response.status).toBe(409)
    const data = await response.json()
    expect(data.error).toContain('phone number already exists')
  })

  it('should return 403 when patient limit is reached', async () => {
    vi.mocked(checkPatientLimit).mockResolvedValue({
      allowed: false,
      current: 100,
      max: 100,
    })

    const request = new NextRequest('http://localhost:3000/api/patients', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'John',
        lastName: 'Doe',
        phone: '9876543210',
      }),
    })
    const response = await POST(request)

    expect(response.status).toBe(403)
    const data = await response.json()
    expect(data.error).toBe('Patient limit reached')
  })

  it('should handle database errors gracefully', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.patient.create).mockRejectedValue(new Error('Database error'))

    const request = new NextRequest('http://localhost:3000/api/patients', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'John',
        lastName: 'Doe',
        phone: '9876543210',
      }),
    })
    const response = await POST(request)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('Failed to create patient')
  })
})
