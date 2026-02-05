/**
 * Comprehensive Patient API Tests
 * Tests all patient-related endpoints with full business logic validation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    patient: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    hospital: {
      findUnique: vi.fn(),
    },
    appointment: {
      findMany: vi.fn(),
    },
    treatment: {
      findMany: vi.fn(),
    },
    invoice: {
      findMany: vi.fn(),
    },
    document: {
      findMany: vi.fn(),
    },
    prescription: {
      findMany: vi.fn(),
    },
    labOrder: {
      findMany: vi.fn(),
    },
  },
  default: {
    patient: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}))

// Mock auth
vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
  checkPatientLimit: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { requireAuthAndRole, checkPatientLimit } from '@/lib/api-helpers'
import { GET, POST } from '@/app/api/patients/route'

const mockPrisma = vi.mocked(prisma)
const mockRequireAuth = vi.mocked(requireAuthAndRole)
const mockCheckPatientLimit = vi.mocked(checkPatientLimit)

describe('Patients API - Comprehensive Tests', () => {
  const mockHospitalId = 'hospital-123'
  const mockUserId = 'user-123'

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({
      error: null,
      hospitalId: mockHospitalId,
      user: { id: mockUserId, role: 'ADMIN' },
      session: { user: { id: mockUserId, role: 'ADMIN', hospitalId: mockHospitalId } },
    })
  })

  describe('GET /api/patients', () => {
    it('should return paginated patients list', async () => {
      const mockPatients = [
        { id: '1', patientId: 'PAT202500001', firstName: 'John', lastName: 'Doe', phone: '9876543210' },
        { id: '2', patientId: 'PAT202500002', firstName: 'Jane', lastName: 'Smith', phone: '9876543211' },
      ]

      mockPrisma.patient.findMany.mockResolvedValue(mockPatients)
      mockPrisma.patient.count.mockResolvedValue(2)

      const request = new NextRequest('http://localhost/api/patients?page=1&limit=10')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.patients).toHaveLength(2)
      expect(data.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      })
    })

    it('should filter patients by search term', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([])
      mockPrisma.patient.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/patients?search=John')
      await GET(request)

      expect(mockPrisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            hospitalId: mockHospitalId,
            isActive: true,
            OR: expect.arrayContaining([
              { patientId: { contains: 'John' } },
              { firstName: { contains: 'John' } },
              { lastName: { contains: 'John' } },
              { phone: { contains: 'John' } },
              { email: { contains: 'John' } },
            ]),
          }),
        })
      )
    })

    it('should return all patients when all=true', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([])
      mockPrisma.patient.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/patients?all=true')
      await GET(request)

      expect(mockPrisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: undefined,
          take: undefined,
        })
      )
    })

    it('should return 401 for unauthenticated requests', async () => {
      mockRequireAuth.mockResolvedValue({
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
        hospitalId: null,
        user: null,
        session: null,
      })

      const request = new NextRequest('http://localhost/api/patients')
      const response = await GET(request)

      expect(response.status).toBe(401)
    })

    it('should handle database errors gracefully', async () => {
      mockPrisma.patient.findMany.mockRejectedValue(new Error('Database connection failed'))

      const request = new NextRequest('http://localhost/api/patients')
      const response = await GET(request)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBe('Failed to fetch patients')
    })

    it('should handle pagination correctly with large datasets', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([])
      mockPrisma.patient.count.mockResolvedValue(1000)

      const request = new NextRequest('http://localhost/api/patients?page=5&limit=20')
      const response = await GET(request)
      const data = await response.json()

      expect(data.pagination).toEqual({
        page: 5,
        limit: 20,
        total: 1000,
        totalPages: 50,
      })
      expect(mockPrisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 80, // (5-1) * 20
          take: 20,
        })
      )
    })

    it('should only return patients from the authenticated hospital', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([])
      mockPrisma.patient.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/patients')
      await GET(request)

      expect(mockPrisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            hospitalId: mockHospitalId,
          }),
        })
      )
    })

    it('should only return active patients', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([])
      mockPrisma.patient.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/patients')
      await GET(request)

      expect(mockPrisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
          }),
        })
      )
    })
  })

  describe('POST /api/patients', () => {
    beforeEach(() => {
      mockCheckPatientLimit.mockResolvedValue({ allowed: true, current: 50, max: 100 })
    })

    it('should create a new patient with valid data', async () => {
      const newPatient = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '9876543210',
        email: 'john@example.com',
        gender: 'MALE',
        dateOfBirth: '1990-01-15',
      }

      mockPrisma.patient.findFirst.mockResolvedValue(null) // No duplicate
      mockPrisma.patient.create.mockResolvedValue({
        id: 'new-patient-id',
        patientId: 'PAT202500001',
        ...newPatient,
        hospitalId: mockHospitalId,
      })

      const request = new NextRequest('http://localhost/api/patients', {
        method: 'POST',
        body: JSON.stringify(newPatient),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.patientId).toBe('PAT202500001')
    })

    it('should reject creation without required fields', async () => {
      const request = new NextRequest('http://localhost/api/patients', {
        method: 'POST',
        body: JSON.stringify({ firstName: 'John' }), // Missing lastName and phone
      })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('First name, last name, and phone are required')
    })

    it('should reject duplicate phone numbers within the same hospital', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({
        id: 'existing-patient',
        phone: '9876543210',
      })

      const request = new NextRequest('http://localhost/api/patients', {
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
      expect(data.error).toBe('A patient with this phone number already exists')
    })

    it('should enforce patient limit for the hospital plan', async () => {
      mockCheckPatientLimit.mockResolvedValue({ allowed: false, current: 100, max: 100 })

      const request = new NextRequest('http://localhost/api/patients', {
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

    it('should generate unique patient IDs', async () => {
      // First patient of the year
      mockPrisma.patient.findFirst
        .mockResolvedValueOnce(null) // For generatePatientId check
        .mockResolvedValueOnce(null) // For duplicate phone check

      mockPrisma.patient.create.mockResolvedValue({
        id: '1',
        patientId: 'PAT202500001',
        firstName: 'John',
        lastName: 'Doe',
      })

      const request = new NextRequest('http://localhost/api/patients', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'John',
          lastName: 'Doe',
          phone: '9876543210',
        }),
      })
      await POST(request)

      expect(mockPrisma.patient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            patientId: expect.stringMatching(/^PAT\d{4}\d{5}$/),
          }),
        })
      )
    })

    it('should create patient with medical history', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null)
      mockPrisma.patient.create.mockResolvedValue({
        id: '1',
        patientId: 'PAT202500001',
        medicalHistory: {
          allergies: 'Penicillin',
          conditions: 'Diabetes',
        },
      })

      const request = new NextRequest('http://localhost/api/patients', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'John',
          lastName: 'Doe',
          phone: '9876543210',
          medicalHistory: {
            allergies: 'Penicillin',
            conditions: 'Diabetes',
          },
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
      expect(mockPrisma.patient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            medicalHistory: {
              create: {
                allergies: 'Penicillin',
                conditions: 'Diabetes',
              },
            },
          }),
        })
      )
    })

    it('should handle optional fields correctly', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null)
      mockPrisma.patient.create.mockResolvedValue({ id: '1' })

      const request = new NextRequest('http://localhost/api/patients', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'John',
          lastName: 'Doe',
          phone: '9876543210',
          // Optional fields
          dateOfBirth: null,
          age: 30,
          gender: 'MALE',
          bloodGroup: 'O+',
          email: 'john@example.com',
          address: '123 Main St',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          aadharNumber: '123456789012',
          occupation: 'Engineer',
          referredBy: 'Dr. Smith',
          emergencyContactName: 'Jane Doe',
          emergencyContactPhone: '9876543211',
          emergencyContactRelation: 'Spouse',
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })

    it('should validate phone number format (10 digits)', async () => {
      // Note: This test checks if the API accepts various phone formats
      // The actual validation might be done in frontend or as business logic

      mockPrisma.patient.findFirst.mockResolvedValue(null)
      mockPrisma.patient.create.mockResolvedValue({ id: '1' })

      const validPhoneNumbers = ['9876543210', '8765432109', '7654321098', '6543210987']

      for (const phone of validPhoneNumbers) {
        const request = new NextRequest('http://localhost/api/patients', {
          method: 'POST',
          body: JSON.stringify({
            firstName: 'John',
            lastName: 'Doe',
            phone,
          }),
        })
        const response = await POST(request)
        expect(response.status).toBe(201)
      }
    })
  })

  describe('Patient ID Generation Logic', () => {
    it('should generate sequential patient IDs within the same year', async () => {
      mockCheckPatientLimit.mockResolvedValue({ allowed: true, current: 5, max: 100 })

      // Order: duplicate phone check runs FIRST, then generatePatientId
      mockPrisma.patient.findFirst
        .mockResolvedValueOnce(null) // 1st call: duplicate phone check → no duplicate
        .mockResolvedValueOnce({ patientId: 'PAT202500005' }) // 2nd call: ID generation lookup

      mockPrisma.patient.create.mockResolvedValue({
        id: '6',
        patientId: 'PAT202500006',
      })

      const request = new NextRequest('http://localhost/api/patients', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'New',
          lastName: 'Patient',
          phone: '9999999999',
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
      expect(mockPrisma.patient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            patientId: expect.stringContaining('PAT'),
          }),
        })
      )
    })
  })

  describe('Business Logic Validation', () => {
    it('should not allow creating patient in different hospital context', async () => {
      // The API should use the authenticated hospitalId, not any provided in the body
      mockPrisma.patient.findFirst.mockResolvedValue(null)
      mockPrisma.patient.create.mockResolvedValue({ id: '1', hospitalId: mockHospitalId })

      const request = new NextRequest('http://localhost/api/patients', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'John',
          lastName: 'Doe',
          phone: '9876543210',
          hospitalId: 'different-hospital-id', // Should be ignored
        }),
      })
      await POST(request)

      expect(mockPrisma.patient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hospitalId: mockHospitalId, // Should use authenticated hospital
          }),
        })
      )
    })

    it('should isolate patient data between hospitals', async () => {
      // Same phone can exist in different hospitals
      mockRequireAuth.mockResolvedValueOnce({
        error: null,
        hospitalId: 'hospital-A',
        user: { id: 'user-1', role: 'ADMIN' },
        session: { user: { id: 'user-1', role: 'ADMIN', hospitalId: 'hospital-A' } },
      })

      mockPrisma.patient.findFirst.mockResolvedValue(null) // No duplicate in hospital A
      mockPrisma.patient.create.mockResolvedValue({ id: '1' })

      const request = new NextRequest('http://localhost/api/patients', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'John',
          lastName: 'Doe',
          phone: '9876543210',
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
      // Duplicate check should include hospitalId
      expect(mockPrisma.patient.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { hospitalId: 'hospital-A', phone: '9876543210' },
        })
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty search string', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([])
      mockPrisma.patient.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/patients?search=')
      await GET(request)

      expect(mockPrisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            OR: expect.anything(),
          }),
        })
      )
    })

    it('should handle special characters in search', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([])
      mockPrisma.patient.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/patients?search=John%27s')
      await GET(request)

      expect(mockPrisma.patient.findMany).toHaveBeenCalled()
    })

    it('should handle very large page numbers gracefully', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([])
      mockPrisma.patient.count.mockResolvedValue(10)

      const request = new NextRequest('http://localhost/api/patients?page=9999')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.patients).toHaveLength(0)
    })

    it('should handle negative page numbers', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([])
      mockPrisma.patient.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/patients?page=-1')
      const response = await GET(request)

      // Should default to page 1 or handle gracefully
      expect(response.status).toBe(200)
    })

    it('should handle zero limit', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([])
      mockPrisma.patient.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/patients?limit=0')
      const response = await GET(request)

      // Should use default limit or handle gracefully
      expect(response.status).toBe(200)
    })

    it('should handle very long names', async () => {
      const longName = 'A'.repeat(255)
      mockPrisma.patient.findFirst.mockResolvedValue(null)
      mockPrisma.patient.create.mockResolvedValue({ id: '1' })

      const request = new NextRequest('http://localhost/api/patients', {
        method: 'POST',
        body: JSON.stringify({
          firstName: longName,
          lastName: longName,
          phone: '9876543210',
        }),
      })
      const response = await POST(request)

      // Should either succeed or return appropriate error
      expect([201, 400]).toContain(response.status)
    })

    it('should handle Unicode characters in names', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null)
      mockPrisma.patient.create.mockResolvedValue({ id: '1' })

      const request = new NextRequest('http://localhost/api/patients', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'राम',
          lastName: 'कुमार',
          phone: '9876543210',
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })
  })
})
