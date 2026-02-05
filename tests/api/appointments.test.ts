import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock modules with inline factories - these get hoisted
vi.mock('@/lib/prisma', () => ({
  prisma: {
    appointment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    patient: {
      findFirst: vi.fn(),
    },
    staff: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
  requireRole: vi.fn(),
  PLAN_LIMITS: {
    FREE: { patientLimit: 100, staffLimit: 3, storageLimitMb: 500 },
    PROFESSIONAL: { patientLimit: -1, staffLimit: -1, storageLimitMb: -1 },
    ENTERPRISE: { patientLimit: -1, staffLimit: -1, storageLimitMb: -1 },
    SELF_HOSTED: { patientLimit: -1, staffLimit: -1, storageLimitMb: -1 },
  },
}))

// Import after mocks
import { GET, POST } from '@/app/api/appointments/route'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

describe('Appointments API - GET /api/appointments', () => {
  beforeEach(() => {
    vi.clearAllMocks()

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

    const request = new NextRequest('http://localhost:3000/api/appointments')
    const response = await GET(request)

    expect(response.status).toBe(401)
  })

  it('should return appointments list with pagination', async () => {
    const mockAppointments = [
      {
        id: 'apt-1',
        appointmentNo: 'APT202501150001',
        scheduledDate: new Date('2030-06-15'),
        scheduledTime: '09:00',
        status: 'SCHEDULED',
        patient: {
          id: 'patient-1',
          patientId: 'PAT202500001',
          firstName: 'John',
          lastName: 'Doe',
          phone: '9876543210',
          email: 'john@example.com',
        },
        doctor: {
          id: 'doctor-1',
          firstName: 'Priya',
          lastName: 'Patel',
          specialization: 'General Dentistry',
        },
      },
    ]

    vi.mocked(prisma.appointment.findMany).mockResolvedValue(mockAppointments as any)
    vi.mocked(prisma.appointment.count).mockResolvedValue(1)

    const request = new NextRequest('http://localhost:3000/api/appointments?page=1&limit=10')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.appointments).toHaveLength(1)
    expect(data.pagination.page).toBe(1)
    expect(data.pagination.total).toBe(1)
  })

  it('should filter by status', async () => {
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.appointment.count).mockResolvedValue(0)

    const request = new NextRequest('http://localhost:3000/api/appointments?status=SCHEDULED')
    await GET(request)

    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'SCHEDULED',
        }),
      })
    )
  })

  it('should handle database errors gracefully', async () => {
    vi.mocked(prisma.appointment.findMany).mockRejectedValue(new Error('Database error'))

    const request = new NextRequest('http://localhost:3000/api/appointments')
    const response = await GET(request)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('Failed to fetch appointments')
  })
})

describe('Appointments API - POST /api/appointments', () => {
  beforeEach(() => {
    vi.clearAllMocks()

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

    const request = new NextRequest('http://localhost:3000/api/appointments', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const response = await POST(request)

    expect(response.status).toBe(401)
  })

  it('should create appointment with valid data', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({
      id: 'patient-1',
      hospitalId: 'hospital-1',
    } as any)
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({
      id: 'doctor-1',
      hospitalId: 'hospital-1',
    } as any)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null) // No conflict
    vi.mocked(prisma.appointment.create).mockResolvedValue({
      id: 'new-apt-id',
      appointmentNo: 'APT202501150001',
      patientId: 'patient-1',
      doctorId: 'doctor-1',
      scheduledDate: new Date('2030-06-15'),
      scheduledTime: '09:00',
      status: 'SCHEDULED',
      patient: {
        id: 'patient-1',
        patientId: 'PAT202500001',
        firstName: 'John',
        lastName: 'Doe',
        phone: '9876543210',
      },
      doctor: {
        id: 'doctor-1',
        firstName: 'Priya',
        lastName: 'Patel',
      },
    } as any)

    const request = new NextRequest('http://localhost:3000/api/appointments', {
      method: 'POST',
      body: JSON.stringify({
        patientId: 'patient-1',
        doctorId: 'doctor-1',
        scheduledDate: '2030-06-15',
        scheduledTime: '09:00',
        duration: 30,
        appointmentType: 'CONSULTATION',
        priority: 'NORMAL',
      }),
    })
    const response = await POST(request)

    expect(response.status).toBe(201)
  })

  it('should return 400 for missing required fields', async () => {
    const request = new NextRequest('http://localhost:3000/api/appointments', {
      method: 'POST',
      body: JSON.stringify({
        patientId: 'patient-1',
        // Missing doctorId, scheduledDate, scheduledTime
      }),
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('required')
  })

  it('should return 404 when patient not found', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/appointments', {
      method: 'POST',
      body: JSON.stringify({
        patientId: 'non-existent-patient',
        doctorId: 'doctor-1',
        scheduledDate: '2030-06-15',
        scheduledTime: '09:00',
      }),
    })
    const response = await POST(request)

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe('Patient not found')
  })

  it('should return 404 when doctor not found', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({
      id: 'patient-1',
      hospitalId: 'hospital-1',
    } as any)
    vi.mocked(prisma.staff.findFirst).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/appointments', {
      method: 'POST',
      body: JSON.stringify({
        patientId: 'patient-1',
        doctorId: 'non-existent-doctor',
        scheduledDate: '2030-06-15',
        scheduledTime: '09:00',
      }),
    })
    const response = await POST(request)

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe('Doctor not found')
  })

  it('should return 409 for conflicting appointments', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({
      id: 'patient-1',
      hospitalId: 'hospital-1',
    } as any)
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({
      id: 'doctor-1',
      hospitalId: 'hospital-1',
    } as any)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      id: 'existing-apt',
      scheduledDate: new Date('2030-06-15'),
      scheduledTime: '09:00',
    } as any)

    const request = new NextRequest('http://localhost:3000/api/appointments', {
      method: 'POST',
      body: JSON.stringify({
        patientId: 'patient-1',
        doctorId: 'doctor-1',
        scheduledDate: '2030-06-15',
        scheduledTime: '09:00',
      }),
    })
    const response = await POST(request)

    expect(response.status).toBe(409)
    const data = await response.json()
    expect(data.error).toContain('already has an appointment')
  })

  it('should handle database errors gracefully', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({
      id: 'patient-1',
      hospitalId: 'hospital-1',
    } as any)
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({
      id: 'doctor-1',
      hospitalId: 'hospital-1',
    } as any)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.appointment.create).mockRejectedValue(new Error('Database error'))

    const request = new NextRequest('http://localhost:3000/api/appointments', {
      method: 'POST',
      body: JSON.stringify({
        patientId: 'patient-1',
        doctorId: 'doctor-1',
        scheduledDate: '2030-06-15',
        scheduledTime: '09:00',
      }),
    })
    const response = await POST(request)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('Failed to create appointment')
  })
})
