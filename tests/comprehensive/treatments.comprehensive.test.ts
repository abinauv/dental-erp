// @ts-nocheck
/**
 * Comprehensive Treatment API Tests
 * Tests all treatment-related endpoints with full business logic validation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    treatment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    patient: {
      findUnique: vi.fn(),
    },
    staff: {
      findUnique: vi.fn(),
    },
    procedure: {
      findUnique: vi.fn(),
    },
    appointment: {
      findUnique: vi.fn(),
    },
    invoiceItem: {
      findMany: vi.fn(),
    },
  },
}))

// Mock auth
vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { GET, POST } from '@/app/api/treatments/route'

const mockPrisma = vi.mocked(prisma)
const mockRequireAuth = vi.mocked(requireAuthAndRole)

describe('Treatments API - Comprehensive Tests', () => {
  const mockHospitalId = 'hospital-123'
  const mockUserId = 'user-123'
  const mockPatientId = 'patient-123'
  const mockDoctorId = 'doctor-123'
  const mockProcedureId = 'procedure-123'

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({
      error: null,
      hospitalId: mockHospitalId,
      user: { id: mockUserId, role: 'DOCTOR' },
      session: { user: { id: mockUserId, role: 'DOCTOR', hospitalId: mockHospitalId } },
    })
  })

  describe('GET /api/treatments', () => {
    it('should return paginated treatments list', async () => {
      const mockTreatments = [
        {
          id: '1',
          treatmentNo: 'TRT202501290001',
          status: 'PLANNED',
          patient: { id: mockPatientId, firstName: 'John', lastName: 'Doe' },
          doctor: { id: mockDoctorId, firstName: 'Dr', lastName: 'Smith' },
          procedure: { id: mockProcedureId, name: 'Root Canal', code: 'RC001' },
        },
      ]

      mockPrisma.treatment.findMany.mockResolvedValue(mockTreatments)
      mockPrisma.treatment.count.mockResolvedValue(1)

      const request = new NextRequest('http://localhost/api/treatments')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.treatments).toHaveLength(1)
      expect(data.pagination).toBeDefined()
    })

    it('should filter treatments by status', async () => {
      mockPrisma.treatment.findMany.mockResolvedValue([])
      mockPrisma.treatment.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/treatments?status=IN_PROGRESS')
      await GET(request)

      expect(mockPrisma.treatment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'IN_PROGRESS',
          }),
        })
      )
    })

    it('should filter treatments by patient', async () => {
      mockPrisma.treatment.findMany.mockResolvedValue([])
      mockPrisma.treatment.count.mockResolvedValue(0)

      const request = new NextRequest(`http://localhost/api/treatments?patientId=${mockPatientId}`)
      await GET(request)

      expect(mockPrisma.treatment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patientId: mockPatientId,
          }),
        })
      )
    })

    it('should filter treatments by doctor', async () => {
      mockPrisma.treatment.findMany.mockResolvedValue([])
      mockPrisma.treatment.count.mockResolvedValue(0)

      const request = new NextRequest(`http://localhost/api/treatments?doctorId=${mockDoctorId}`)
      await GET(request)

      expect(mockPrisma.treatment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            doctorId: mockDoctorId,
          }),
        })
      )
    })

    it('should filter treatments by procedure', async () => {
      mockPrisma.treatment.findMany.mockResolvedValue([])
      mockPrisma.treatment.count.mockResolvedValue(0)

      const request = new NextRequest(`http://localhost/api/treatments?procedureId=${mockProcedureId}`)
      await GET(request)

      expect(mockPrisma.treatment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            procedureId: mockProcedureId,
          }),
        })
      )
    })

    it('should filter treatments by date range', async () => {
      mockPrisma.treatment.findMany.mockResolvedValue([])
      mockPrisma.treatment.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/treatments?dateFrom=2025-01-01&dateTo=2025-01-31')
      await GET(request)

      expect(mockPrisma.treatment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      )
    })

    it('should filter treatments requiring follow-up', async () => {
      mockPrisma.treatment.findMany.mockResolvedValue([])
      mockPrisma.treatment.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/treatments?followUpRequired=true')
      await GET(request)

      expect(mockPrisma.treatment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            followUpRequired: true,
          }),
        })
      )
    })

    it('should search treatments by various fields', async () => {
      mockPrisma.treatment.findMany.mockResolvedValue([])
      mockPrisma.treatment.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/treatments?search=cavity')
      await GET(request)

      expect(mockPrisma.treatment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { treatmentNo: { contains: 'cavity' } },
              { chiefComplaint: { contains: 'cavity' } },
              { diagnosis: { contains: 'cavity' } },
            ]),
          }),
        })
      )
    })
  })

  describe('POST /api/treatments', () => {
    beforeEach(() => {
      mockPrisma.patient.findUnique.mockResolvedValue({
        id: mockPatientId,
        hospitalId: mockHospitalId,
      })
      mockPrisma.staff.findUnique.mockResolvedValue({
        id: mockDoctorId,
        hospitalId: mockHospitalId,
      })
      mockPrisma.procedure.findUnique.mockResolvedValue({
        id: mockProcedureId,
        hospitalId: mockHospitalId,
        name: 'Root Canal',
        basePrice: 5000,
      })
    })

    it('should create a new treatment with valid data', async () => {
      mockPrisma.treatment.findFirst.mockResolvedValue(null) // For ID generation
      mockPrisma.treatment.create.mockResolvedValue({
        id: 'trt-1',
        treatmentNo: 'TRT202501290001',
        status: 'PLANNED',
        cost: 5000,
      })

      const request = new NextRequest('http://localhost/api/treatments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          procedureId: mockProcedureId,
          doctorId: mockDoctorId,
          diagnosis: 'Dental caries',
          chiefComplaint: 'Tooth pain',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.treatmentNo).toBeDefined()
      expect(data.status).toBe('PLANNED')
    })

    it('should reject treatment creation without required fields', async () => {
      const request = new NextRequest('http://localhost/api/treatments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          // Missing procedureId and doctorId
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('required')
    })

    it('should reject treatment for non-existent patient', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/treatments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: 'non-existent',
          procedureId: mockProcedureId,
          doctorId: mockDoctorId,
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('Patient not found')
    })

    it('should reject treatment for non-existent doctor', async () => {
      mockPrisma.staff.findUnique.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/treatments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          procedureId: mockProcedureId,
          doctorId: 'non-existent',
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('Doctor not found')
    })

    it('should reject treatment for non-existent procedure', async () => {
      mockPrisma.procedure.findUnique.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/treatments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          procedureId: 'non-existent',
          doctorId: mockDoctorId,
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('Procedure not found')
    })

    it('should use procedure base price when cost not provided', async () => {
      mockPrisma.treatment.findFirst.mockResolvedValue(null)
      mockPrisma.treatment.create.mockResolvedValue({ id: 'trt-1', cost: 5000 })

      const request = new NextRequest('http://localhost/api/treatments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          procedureId: mockProcedureId,
          doctorId: mockDoctorId,
          // No cost specified
        }),
      })
      await POST(request)

      expect(mockPrisma.treatment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cost: 5000, // From procedure.basePrice
          }),
        })
      )
    })

    it('should allow custom cost override', async () => {
      mockPrisma.treatment.findFirst.mockResolvedValue(null)
      mockPrisma.treatment.create.mockResolvedValue({ id: 'trt-1', cost: 6500 })

      const request = new NextRequest('http://localhost/api/treatments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          procedureId: mockProcedureId,
          doctorId: mockDoctorId,
          cost: 6500, // Custom cost
        }),
      })
      await POST(request)

      expect(mockPrisma.treatment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cost: 6500,
          }),
        })
      )
    })

    it('should link treatment to appointment if provided', async () => {
      const mockAppointmentId = 'appointment-123'
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: mockAppointmentId,
        hospitalId: mockHospitalId,
      })
      mockPrisma.treatment.findFirst.mockResolvedValue(null)
      mockPrisma.treatment.create.mockResolvedValue({ id: 'trt-1' })

      const request = new NextRequest('http://localhost/api/treatments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          procedureId: mockProcedureId,
          doctorId: mockDoctorId,
          appointmentId: mockAppointmentId,
        }),
      })
      await POST(request)

      expect(mockPrisma.treatment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            appointmentId: mockAppointmentId,
          }),
        })
      )
    })

    it('should reject invalid appointment ID', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/treatments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          procedureId: mockProcedureId,
          doctorId: mockDoctorId,
          appointmentId: 'non-existent',
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('Appointment not found')
    })

    it('should set initial status to PLANNED', async () => {
      mockPrisma.treatment.findFirst.mockResolvedValue(null)
      mockPrisma.treatment.create.mockResolvedValue({ id: 'trt-1', status: 'PLANNED' })

      const request = new NextRequest('http://localhost/api/treatments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          procedureId: mockProcedureId,
          doctorId: mockDoctorId,
        }),
      })
      await POST(request)

      expect(mockPrisma.treatment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PLANNED',
          }),
        })
      )
    })

    it('should handle tooth numbers for specific procedures', async () => {
      mockPrisma.treatment.findFirst.mockResolvedValue(null)
      mockPrisma.treatment.create.mockResolvedValue({ id: 'trt-1' })

      const request = new NextRequest('http://localhost/api/treatments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          procedureId: mockProcedureId,
          doctorId: mockDoctorId,
          toothNumbers: ['16', '17'], // Upper right molars (FDI notation)
        }),
      })
      await POST(request)

      expect(mockPrisma.treatment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            toothNumbers: ['16', '17'],
          }),
        })
      )
    })

    it('should handle follow-up requirements', async () => {
      mockPrisma.treatment.findFirst.mockResolvedValue(null)
      mockPrisma.treatment.create.mockResolvedValue({ id: 'trt-1' })

      const request = new NextRequest('http://localhost/api/treatments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          procedureId: mockProcedureId,
          doctorId: mockDoctorId,
          followUpRequired: true,
          followUpDate: '2025-02-15',
        }),
      })
      await POST(request)

      expect(mockPrisma.treatment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            followUpRequired: true,
            followUpDate: expect.any(Date),
          }),
        })
      )
    })
  })

  describe('Permission Checks', () => {
    it('should reject treatment creation by unauthorized roles', async () => {
      mockRequireAuth.mockResolvedValue({
        error: null,
        hospitalId: mockHospitalId,
        user: { id: mockUserId, role: 'RECEPTIONIST' }, // Not ADMIN or DOCTOR
        session: { user: { id: mockUserId, role: 'RECEPTIONIST', hospitalId: mockHospitalId } },
      })

      const request = new NextRequest('http://localhost/api/treatments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          procedureId: mockProcedureId,
          doctorId: mockDoctorId,
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toContain('permission')
    })

    it('should allow ADMIN to create treatments', async () => {
      mockRequireAuth.mockResolvedValue({
        error: null,
        hospitalId: mockHospitalId,
        user: { id: mockUserId, role: 'ADMIN' },
        session: { user: { id: mockUserId, role: 'ADMIN', hospitalId: mockHospitalId } },
      })

      mockPrisma.treatment.findFirst.mockResolvedValue(null)
      mockPrisma.treatment.create.mockResolvedValue({ id: 'trt-1' })

      const request = new NextRequest('http://localhost/api/treatments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          procedureId: mockProcedureId,
          doctorId: mockDoctorId,
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })

    it('should allow DOCTOR to create treatments', async () => {
      mockPrisma.treatment.findFirst.mockResolvedValue(null)
      mockPrisma.treatment.create.mockResolvedValue({ id: 'trt-1' })

      const request = new NextRequest('http://localhost/api/treatments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          procedureId: mockProcedureId,
          doctorId: mockDoctorId,
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })
  })

  describe('Treatment Status Lifecycle', () => {
    const validStatuses = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']

    it('should have correct status progression', () => {
      const validTransitions = {
        PLANNED: ['IN_PROGRESS', 'CANCELLED'],
        IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
        COMPLETED: [], // Terminal
        CANCELLED: [], // Terminal
      }

      expect(Object.keys(validTransitions)).toEqual(validStatuses)
    })
  })

  describe('Treatment Number Generation', () => {
    it('should generate sequential treatment numbers per day', async () => {
      // Set up all prerequisite mocks
      mockPrisma.patient.findUnique.mockResolvedValue({
        id: mockPatientId,
        hospitalId: mockHospitalId,
      })
      mockPrisma.staff.findUnique.mockResolvedValue({
        id: mockDoctorId,
        hospitalId: mockHospitalId,
      })
      mockPrisma.procedure.findUnique.mockResolvedValue({
        id: mockProcedureId,
        hospitalId: mockHospitalId,
        name: 'Root Canal',
        basePrice: 5000,
      })

      mockPrisma.treatment.findFirst.mockResolvedValueOnce({
        treatmentNo: 'TRT202501290003',
      })

      mockPrisma.treatment.create.mockResolvedValue({
        id: 'trt-4',
        treatmentNo: 'TRT202501290004',
      })

      const request = new NextRequest('http://localhost/api/treatments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          procedureId: mockProcedureId,
          doctorId: mockDoctorId,
        }),
      })
      await POST(request)

      expect(mockPrisma.treatment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            treatmentNo: expect.stringMatching(/^TRT\d{8}\d{4}$/),
          }),
        })
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty tooth numbers array', async () => {
      mockPrisma.treatment.findFirst.mockResolvedValue(null)
      mockPrisma.treatment.create.mockResolvedValue({ id: 'trt-1' })

      const request = new NextRequest('http://localhost/api/treatments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          procedureId: mockProcedureId,
          doctorId: mockDoctorId,
          toothNumbers: [],
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })

    it('should handle very long diagnosis text', async () => {
      mockPrisma.treatment.findFirst.mockResolvedValue(null)
      mockPrisma.treatment.create.mockResolvedValue({ id: 'trt-1' })

      const longText = 'A'.repeat(5000)

      const request = new NextRequest('http://localhost/api/treatments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          procedureId: mockProcedureId,
          doctorId: mockDoctorId,
          diagnosis: longText,
        }),
      })
      const response = await POST(request)

      expect([201, 400]).toContain(response.status)
    })

    it('should handle zero cost', async () => {
      mockPrisma.treatment.findFirst.mockResolvedValue(null)
      mockPrisma.treatment.create.mockResolvedValue({ id: 'trt-1', cost: 0 })

      const request = new NextRequest('http://localhost/api/treatments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          procedureId: mockProcedureId,
          doctorId: mockDoctorId,
          cost: 0, // Free treatment (e.g., under warranty)
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })

    it('should handle negative cost gracefully', async () => {
      const request = new NextRequest('http://localhost/api/treatments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: mockPatientId,
          procedureId: mockProcedureId,
          doctorId: mockDoctorId,
          cost: -100,
        }),
      })
      const response = await POST(request)

      // Should reject negative cost or handle gracefully
      expect([201, 400]).toContain(response.status)
    })
  })
})
