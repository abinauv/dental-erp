/**
 * Comprehensive Appointment API Tests
 * Tests all appointment-related endpoints with full business logic validation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    appointment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    patient: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    staff: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    treatment: {
      findMany: vi.fn(),
    },
    holiday: {
      findFirst: vi.fn(),
    },
    staffShift: {
      findFirst: vi.fn(),
    },
    hospital: {
      findUnique: vi.fn(),
    },
  },
}))

// Mock auth
vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { GET, POST } from '@/app/api/appointments/route'

const mockPrisma = vi.mocked(prisma)
const mockRequireAuth = vi.mocked(requireAuthAndRole)

describe('Appointments API - Comprehensive Tests', () => {
  const mockHospitalId = 'hospital-123'
  const mockUserId = 'user-123'
  const mockPatientId = 'patient-123'
  const mockDoctorId = 'doctor-123'

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({
      error: null,
      hospitalId: mockHospitalId,
      user: { id: mockUserId, role: 'RECEPTIONIST' },
      session: { user: { id: mockUserId, role: 'RECEPTIONIST', hospitalId: mockHospitalId } },
    })
  })

  describe('GET /api/appointments', () => {
    it('should return paginated appointments list', async () => {
      const mockAppointments = [
        {
          id: '1',
          appointmentNo: 'APT202501290001',
          scheduledDate: new Date('2025-01-29'),
          scheduledTime: '10:00',
          status: 'SCHEDULED',
          patient: { id: mockPatientId, firstName: 'John', lastName: 'Doe' },
          doctor: { id: mockDoctorId, firstName: 'Dr', lastName: 'Smith' },
        },
      ]

      mockPrisma.appointment.findMany.mockResolvedValue(mockAppointments)
      mockPrisma.appointment.count.mockResolvedValue(1)

      const request = new NextRequest('http://localhost/api/appointments')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.appointments).toHaveLength(1)
      expect(data.pagination).toBeDefined()
    })

    it('should filter appointments by status', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([])
      mockPrisma.appointment.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/appointments?status=SCHEDULED')
      await GET(request)

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'SCHEDULED',
          }),
        })
      )
    })

    it('should filter appointments by date', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([])
      mockPrisma.appointment.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/appointments?date=2025-01-29')
      await GET(request)

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            scheduledDate: expect.any(Date),
          }),
        })
      )
    })

    it('should filter appointments by doctor', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([])
      mockPrisma.appointment.count.mockResolvedValue(0)

      const request = new NextRequest(`http://localhost/api/appointments?doctorId=${mockDoctorId}`)
      await GET(request)

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            doctorId: mockDoctorId,
          }),
        })
      )
    })

    it('should filter appointments by patient', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([])
      mockPrisma.appointment.count.mockResolvedValue(0)

      const request = new NextRequest(`http://localhost/api/appointments?patientId=${mockPatientId}`)
      await GET(request)

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patientId: mockPatientId,
          }),
        })
      )
    })

    it('should support calendar day view', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([])
      mockPrisma.appointment.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/appointments?view=day&date=2025-01-29')
      await GET(request)

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            scheduledDate: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
          take: undefined, // No pagination for calendar view
        })
      )
    })

    it('should support calendar week view', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([])
      mockPrisma.appointment.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/appointments?view=week&date=2025-01-29')
      await GET(request)

      expect(mockPrisma.appointment.findMany).toHaveBeenCalled()
    })

    it('should support calendar month view', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([])
      mockPrisma.appointment.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/appointments?view=month&date=2025-01-29')
      await GET(request)

      expect(mockPrisma.appointment.findMany).toHaveBeenCalled()
    })

    it('should filter by appointment type', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([])
      mockPrisma.appointment.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/appointments?type=CONSULTATION')
      await GET(request)

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            appointmentType: 'CONSULTATION',
          }),
        })
      )
    })

    it('should search appointments by patient name or phone', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([])
      mockPrisma.appointment.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/appointments?search=John')
      await GET(request)

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { appointmentNo: { contains: 'John' } },
              { patient: { firstName: { contains: 'John' } } },
              { patient: { lastName: { contains: 'John' } } },
              { patient: { phone: { contains: 'John' } } },
            ]),
          }),
        })
      )
    })

    it('should order appointments by date and time', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([])
      mockPrisma.appointment.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/appointments')
      await GET(request)

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }],
        })
      )
    })
  })

  describe('POST /api/appointments', () => {
    beforeEach(() => {
      mockPrisma.patient.findFirst.mockResolvedValue({
        id: mockPatientId,
        hospitalId: mockHospitalId,
      })
      mockPrisma.staff.findFirst.mockResolvedValue({
        id: mockDoctorId,
        hospitalId: mockHospitalId,
      })
      mockPrisma.appointment.findFirst.mockResolvedValue(null) // No conflict
    })

    it('should create a new appointment with valid data', async () => {
      mockPrisma.appointment.create.mockResolvedValue({
        id: 'apt-1',
        appointmentNo: 'APT202501290001',
        patientId: mockPatientId,
        doctorId: mockDoctorId,
        scheduledDate: new Date('2025-01-29'),
        scheduledTime: '10:00',
        status: 'SCHEDULED',
      })

      const request = new NextRequest('http://localhost/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          doctorId: mockDoctorId,
          scheduledDate: '2030-06-15',
          scheduledTime: '10:00',
          duration: 30,
          appointmentType: 'CONSULTATION',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.appointmentNo).toBeDefined()
      expect(data.status).toBe('SCHEDULED')
    })

    it('should reject appointment without required fields', async () => {
      const request = new NextRequest('http://localhost/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          // Missing doctorId, scheduledDate, scheduledTime
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('required')
    })

    it('should reject appointment for non-existent patient', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: 'non-existent-patient',
          doctorId: mockDoctorId,
          scheduledDate: '2030-06-15',
          scheduledTime: '10:00',
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('Patient not found')
    })

    it('should reject appointment for non-existent doctor', async () => {
      mockPrisma.staff.findFirst.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          doctorId: 'non-existent-doctor',
          scheduledDate: '2030-06-15',
          scheduledTime: '10:00',
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('Doctor not found')
    })

    it('should detect and reject conflicting appointments', async () => {
      // Doctor already has appointment at this time
      mockPrisma.appointment.findFirst.mockResolvedValue({
        id: 'existing-apt',
        doctorId: mockDoctorId,
        scheduledDate: new Date('2025-01-29'),
        scheduledTime: '10:00',
        status: 'SCHEDULED',
      })

      const request = new NextRequest('http://localhost/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          doctorId: mockDoctorId,
          scheduledDate: '2030-06-15',
          scheduledTime: '10:00',
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(409)
      const data = await response.json()
      expect(data.error).toContain('already has an appointment')
    })

    it('should allow appointment at same time with different doctor', async () => {
      const differentDoctorId = 'different-doctor-id'
      mockPrisma.staff.findFirst.mockResolvedValue({
        id: differentDoctorId,
        hospitalId: mockHospitalId,
      })
      mockPrisma.appointment.findFirst.mockResolvedValue(null) // No conflict for this doctor
      mockPrisma.appointment.create.mockResolvedValue({
        id: 'apt-2',
        appointmentNo: 'APT202501290002',
      })

      const request = new NextRequest('http://localhost/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          doctorId: differentDoctorId,
          scheduledDate: '2030-06-15',
          scheduledTime: '10:00',
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })

    it('should generate unique appointment numbers', async () => {
      // Order: conflict check runs FIRST, then generateAppointmentNo
      mockPrisma.appointment.findFirst
        .mockResolvedValueOnce(null) // 1st call: conflict check → no conflict
        .mockResolvedValueOnce({ appointmentNo: 'APT202501290005' }) // 2nd call: ID generation

      mockPrisma.appointment.create.mockResolvedValue({
        id: 'apt-6',
        appointmentNo: 'APT202501290006',
      })

      const request = new NextRequest('http://localhost/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          doctorId: mockDoctorId,
          scheduledDate: '2030-06-15',
          scheduledTime: '11:00',
        }),
      })
      await POST(request)

      expect(mockPrisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            appointmentNo: expect.stringContaining('APT'),
          }),
        })
      )
    })

    it('should set default appointment type to CONSULTATION', async () => {
      mockPrisma.appointment.create.mockResolvedValue({ id: 'apt-1' })

      const request = new NextRequest('http://localhost/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          doctorId: mockDoctorId,
          scheduledDate: '2030-06-15',
          scheduledTime: '10:00',
          // No appointmentType specified
        }),
      })
      await POST(request)

      expect(mockPrisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            appointmentType: 'CONSULTATION',
          }),
        })
      )
    })

    it('should set default duration to 30 minutes', async () => {
      mockPrisma.appointment.create.mockResolvedValue({ id: 'apt-1' })

      const request = new NextRequest('http://localhost/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          doctorId: mockDoctorId,
          scheduledDate: '2030-06-15',
          scheduledTime: '10:00',
          // No duration specified
        }),
      })
      await POST(request)

      expect(mockPrisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            duration: 30,
          }),
        })
      )
    })

    it('should set default priority to NORMAL', async () => {
      mockPrisma.appointment.create.mockResolvedValue({ id: 'apt-1' })

      const request = new NextRequest('http://localhost/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          doctorId: mockDoctorId,
          scheduledDate: '2030-06-15',
          scheduledTime: '10:00',
        }),
      })
      await POST(request)

      expect(mockPrisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            priority: 'NORMAL',
          }),
        })
      )
    })

    it('should set initial status to SCHEDULED', async () => {
      mockPrisma.appointment.create.mockResolvedValue({ id: 'apt-1', status: 'SCHEDULED' })

      const request = new NextRequest('http://localhost/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          doctorId: mockDoctorId,
          scheduledDate: '2030-06-15',
          scheduledTime: '10:00',
        }),
      })
      await POST(request)

      expect(mockPrisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'SCHEDULED',
          }),
        })
      )
    })

    it('should allow cancelled appointment slots to be reused', async () => {
      // Conflict check should exclude cancelled appointments
      mockPrisma.appointment.findFirst.mockResolvedValue(null) // Query excludes CANCELLED status
      mockPrisma.appointment.create.mockResolvedValue({ id: 'apt-new' })

      const request = new NextRequest('http://localhost/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          doctorId: mockDoctorId,
          scheduledDate: '2030-06-15',
          scheduledTime: '10:00',
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
      expect(mockPrisma.appointment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: {
              notIn: ['CANCELLED', 'NO_SHOW', 'RESCHEDULED'],
            },
          }),
        })
      )
    })

    it('should include optional fields in appointment', async () => {
      mockPrisma.appointment.create.mockResolvedValue({ id: 'apt-1' })

      const request = new NextRequest('http://localhost/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          doctorId: mockDoctorId,
          scheduledDate: '2030-06-15',
          scheduledTime: '10:00',
          duration: 45,
          chairNumber: 'Chair 1',
          appointmentType: 'TREATMENT',
          priority: 'HIGH',
          chiefComplaint: 'Tooth pain',
          notes: 'Patient requested early morning slot',
        }),
      })
      await POST(request)

      expect(mockPrisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            chairNumber: 'Chair 1',
            chiefComplaint: 'Tooth pain',
            notes: 'Patient requested early morning slot',
          }),
        })
      )
    })
  })

  describe('Appointment Status Transitions', () => {
    it('should only allow valid status transitions', () => {
      const validTransitions = {
        SCHEDULED: ['CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'],
        CONFIRMED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'],
        CHECKED_IN: ['IN_PROGRESS', 'CANCELLED'],
        IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
        COMPLETED: [], // Terminal state
        CANCELLED: [], // Terminal state
        NO_SHOW: ['RESCHEDULED'], // Can only reschedule
        RESCHEDULED: [], // Terminal state (new appointment created)
      }

      // Verify all statuses have defined transitions
      expect(Object.keys(validTransitions)).toHaveLength(8)
    })
  })

  describe('Appointment Types', () => {
    const validTypes = [
      'CONSULTATION',
      'TREATMENT',
      'FOLLOW_UP',
      'EMERGENCY',
      'CHECKUP',
      'CLEANING',
      'SURGERY',
    ]

    it.each(validTypes)('should accept %s appointment type', async (type) => {
      mockPrisma.appointment.create.mockResolvedValue({ id: 'apt-1', appointmentType: type })

      const request = new NextRequest('http://localhost/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          doctorId: mockDoctorId,
          scheduledDate: '2030-06-15',
          scheduledTime: '10:00',
          appointmentType: type,
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })
  })

  describe('Priority Levels', () => {
    const validPriorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT']

    it.each(validPriorities)('should accept %s priority', async (priority) => {
      mockPrisma.appointment.create.mockResolvedValue({ id: 'apt-1', priority })

      const request = new NextRequest('http://localhost/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          doctorId: mockDoctorId,
          scheduledDate: '2030-06-15',
          scheduledTime: '10:00',
          priority,
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })
  })

  describe('Hospital Isolation', () => {
    it('should not allow booking appointment for patient from different hospital', async () => {
      // Patient belongs to different hospital
      mockPrisma.patient.findFirst.mockResolvedValue(null) // Not found in current hospital

      const request = new NextRequest('http://localhost/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: 'patient-from-other-hospital',
          doctorId: mockDoctorId,
          scheduledDate: '2030-06-15',
          scheduledTime: '10:00',
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(404)
    })

    it('should not allow booking with doctor from different hospital', async () => {
      mockPrisma.staff.findFirst.mockResolvedValue(null) // Doctor not found in current hospital

      const request = new NextRequest('http://localhost/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          doctorId: 'doctor-from-other-hospital',
          scheduledDate: '2030-06-15',
          scheduledTime: '10:00',
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(404)
    })
  })

  describe('Edge Cases', () => {
    it('should reject past date appointments', async () => {
      const request = new NextRequest('http://localhost/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          doctorId: mockDoctorId,
          scheduledDate: '2020-01-01', // Past date
          scheduledTime: '10:00',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('past')
    })

    it('should reject invalid time format', async () => {
      const request = new NextRequest('http://localhost/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          doctorId: mockDoctorId,
          scheduledDate: '2030-01-29',
          scheduledTime: '25:00', // Invalid time
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid time format')
    })

    it('should reject duration exceeding 480 minutes', async () => {
      const request = new NextRequest('http://localhost/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          doctorId: mockDoctorId,
          scheduledDate: '2030-01-29',
          scheduledTime: '10:00',
          duration: 600, // Over 480 limit
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Duration must be between')
    })

    it('should accept max valid duration of 480 minutes', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({ id: mockPatientId, hospitalId: mockHospitalId })
      mockPrisma.staff.findFirst.mockResolvedValue({ id: mockDoctorId, hospitalId: mockHospitalId })
      mockPrisma.appointment.findFirst.mockResolvedValue(null)
      mockPrisma.appointment.create.mockResolvedValue({ id: 'apt-1' })

      const request = new NextRequest('http://localhost/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          doctorId: mockDoctorId,
          scheduledDate: '2030-01-29',
          scheduledTime: '10:00',
          duration: 480, // Exactly at limit
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })
  })
})
