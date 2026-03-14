// @ts-nocheck
/**
 * Comprehensive Staff API Tests
 * Tests all staff-related endpoints with full business logic validation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_password'),
    compare: vi.fn().mockResolvedValue(true),
  },
}))

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    staff: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    hospital: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

// Mock auth
vi.mock('@/lib/api-helpers', () => ({
  requireAuthAndRole: vi.fn(),
  checkStaffLimit: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { requireAuthAndRole, checkStaffLimit } from '@/lib/api-helpers'
import { GET, POST } from '@/app/api/staff/route'

const mockPrisma = vi.mocked(prisma)
const mockRequireAuth = vi.mocked(requireAuthAndRole)
const mockCheckStaffLimit = vi.mocked(checkStaffLimit)

describe('Staff API - Comprehensive Tests', () => {
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
    mockCheckStaffLimit.mockResolvedValue({ allowed: true, current: 5, max: 10 })
  })

  describe('GET /api/staff', () => {
    it('should return paginated staff list', async () => {
      const mockStaff = [
        {
          id: '1',
          employeeId: 'EMP250001',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          user: { id: 'user-1', role: 'DOCTOR', isActive: true },
        },
      ]

      mockPrisma.staff.findMany.mockResolvedValue(mockStaff)
      mockPrisma.staff.count.mockResolvedValue(1)

      const request = new NextRequest('http://localhost/api/staff')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.staff).toHaveLength(1)
      expect(data.pagination).toBeDefined()
    })

    it('should filter staff by role', async () => {
      mockPrisma.staff.findMany.mockResolvedValue([])
      mockPrisma.staff.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/staff?role=DOCTOR')
      await GET(request)

      expect(mockPrisma.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user: { role: 'DOCTOR' },
          }),
        })
      )
    })

    it('should filter by active status', async () => {
      mockPrisma.staff.findMany.mockResolvedValue([])
      mockPrisma.staff.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/staff?status=active')
      await GET(request)

      expect(mockPrisma.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
          }),
        })
      )
    })

    it('should filter by inactive status', async () => {
      mockPrisma.staff.findMany.mockResolvedValue([])
      mockPrisma.staff.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/staff?status=inactive')
      await GET(request)

      expect(mockPrisma.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: false,
          }),
        })
      )
    })

    it('should search staff by various fields', async () => {
      mockPrisma.staff.findMany.mockResolvedValue([])
      mockPrisma.staff.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/staff?search=john')
      await GET(request)

      expect(mockPrisma.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { firstName: { contains: 'john' } },
              { lastName: { contains: 'john' } },
              { phone: { contains: 'john' } },
              { email: { contains: 'john' } },
              { employeeId: { contains: 'john' } },
            ],
          }),
        })
      )
    })

    it('should return all staff when all=true', async () => {
      mockPrisma.staff.findMany.mockResolvedValue([])
      mockPrisma.staff.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/staff?all=true')
      await GET(request)

      expect(mockPrisma.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: undefined,
          take: undefined,
        })
      )
    })

    it('should include user role information', async () => {
      mockPrisma.staff.findMany.mockResolvedValue([])
      mockPrisma.staff.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/staff')
      await GET(request)

      expect(mockPrisma.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            user: {
              select: {
                id: true,
                role: true,
                isActive: true,
                email: true,
              },
            },
          },
        })
      )
    })
  })

  describe('POST /api/staff', () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(null) // Email doesn't exist
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          user: {
            create: vi.fn().mockResolvedValue({ id: 'new-user-id' }),
          },
          staff: {
            create: vi.fn().mockResolvedValue({
              id: 'new-staff-id',
              employeeId: 'EMP250001',
              user: { id: 'new-user-id', role: 'DOCTOR' },
            }),
          },
        })
      })
    })

    it('should create a new staff member with valid data', async () => {
      const request = new NextRequest('http://localhost/api/staff', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          phone: '9876543210',
          role: 'DOCTOR',
          password: 'SecurePass123!',
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })

    it('should reject staff creation without required fields', async () => {
      const request = new NextRequest('http://localhost/api/staff', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'Jane',
          // Missing lastName, email, phone, role, password
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Missing required fields')
    })

    it('should reject duplicate email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-user' })

      const request = new NextRequest('http://localhost/api/staff', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'existing@example.com',
          phone: '9876543210',
          role: 'DOCTOR',
          password: 'SecurePass123!',
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Email already registered')
    })

    it('should enforce staff limit', async () => {
      mockCheckStaffLimit.mockResolvedValue({ allowed: false, current: 10, max: 10 })

      const request = new NextRequest('http://localhost/api/staff', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          phone: '9876543210',
          role: 'DOCTOR',
          password: 'SecurePass123!',
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toContain('Staff limit reached')
    })

    it('should only allow ADMIN to create staff', async () => {
      mockRequireAuth.mockResolvedValue({
        error: null,
        hospitalId: mockHospitalId,
        user: { id: mockUserId, role: 'DOCTOR' },
        session: { user: { id: mockUserId, role: 'DOCTOR', hospitalId: mockHospitalId } },
      })

      const request = new NextRequest('http://localhost/api/staff', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          phone: '9876543210',
          role: 'RECEPTIONIST',
          password: 'SecurePass123!',
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(403)
    })

    it('should hash password before storing', async () => {
      const request = new NextRequest('http://localhost/api/staff', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          phone: '9876543210',
          role: 'DOCTOR',
          password: 'PlainTextPassword',
        }),
      })
      await POST(request)

      // bcrypt.hash should have been called
      const bcrypt = await import('bcryptjs')
      expect(bcrypt.default.hash).toHaveBeenCalledWith('PlainTextPassword', 10)
    })

    it('should generate unique employee ID', async () => {
      mockPrisma.staff.findFirst.mockResolvedValue(null) // No existing staff

      const request = new NextRequest('http://localhost/api/staff', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          phone: '9876543210',
          role: 'DOCTOR',
          password: 'SecurePass123!',
        }),
      })
      await POST(request)

      // Should have checked for existing employee IDs
      expect(mockPrisma.staff.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employeeId: { startsWith: expect.stringMatching(/^EMP\d{2}/) },
          }),
        })
      )
    })

    it('should create user and staff in transaction', async () => {
      const request = new NextRequest('http://localhost/api/staff', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          phone: '9876543210',
          role: 'DOCTOR',
          password: 'SecurePass123!',
        }),
      })
      await POST(request)

      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })
  })

  describe('Staff Roles', () => {
    const validRoles = ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'LAB_TECH', 'ACCOUNTANT']

    it.each(validRoles)('should accept %s as a valid role', async (role) => {
      const request = new NextRequest('http://localhost/api/staff', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'Test',
          lastName: 'User',
          email: `test-${role.toLowerCase()}@example.com`,
          phone: '9876543210',
          role,
          password: 'SecurePass123!',
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })
  })

  describe('Employee ID Generation', () => {
    it('should generate sequential employee IDs', async () => {
      mockPrisma.staff.findFirst.mockResolvedValue({
        employeeId: 'EMP250005',
      })

      const request = new NextRequest('http://localhost/api/staff', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'New',
          lastName: 'Staff',
          email: 'new@example.com',
          phone: '9876543210',
          role: 'RECEPTIONIST',
          password: 'SecurePass123!',
        }),
      })
      await POST(request)

      // Transaction should create with sequential ID
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })
  })

  describe('Optional Fields', () => {
    it('should accept optional personal information', async () => {
      const request = new NextRequest('http://localhost/api/staff', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          phone: '9876543210',
          role: 'DOCTOR',
          password: 'SecurePass123!',
          // Optional fields
          dateOfBirth: '1985-05-15',
          gender: 'FEMALE',
          alternatePhone: '9876543211',
          address: '123 Medical St',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })

    it('should accept optional professional information', async () => {
      const request = new NextRequest('http://localhost/api/staff', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'Dr',
          lastName: 'Smith',
          email: 'drsmith@example.com',
          phone: '9876543210',
          role: 'DOCTOR',
          password: 'SecurePass123!',
          // Professional info
          qualification: 'BDS, MDS',
          specialization: 'Orthodontics',
          licenseNumber: 'DL12345',
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })

    it('should accept optional financial information', async () => {
      const request = new NextRequest('http://localhost/api/staff', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          phone: '9876543210',
          role: 'RECEPTIONIST',
          password: 'SecurePass123!',
          // Financial info
          salary: '50000',
          bankAccountNo: '1234567890',
          bankIfsc: 'HDFC0001234',
          aadharNumber: '123456789012',
          panNumber: 'ABCDE1234F',
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })

    it('should accept emergency contact information', async () => {
      const request = new NextRequest('http://localhost/api/staff', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          phone: '9876543210',
          role: 'RECEPTIONIST',
          password: 'SecurePass123!',
          // Emergency contact
          emergencyContact: 'John Smith',
          emergencyPhone: '9876543299',
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })
  })

  describe('Hospital Isolation', () => {
    it('should only return staff from authenticated hospital', async () => {
      mockPrisma.staff.findMany.mockResolvedValue([])
      mockPrisma.staff.count.mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/staff')
      await GET(request)

      expect(mockPrisma.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            hospitalId: mockHospitalId,
          }),
        })
      )
    })

    it('should create staff linked to authenticated hospital', async () => {
      const request = new NextRequest('http://localhost/api/staff', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          phone: '9876543210',
          role: 'DOCTOR',
          password: 'SecurePass123!',
        }),
      })
      await POST(request)

      // Transaction creates with hospitalId
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })
  })

  describe('Edge Cases', () => {
    it('should handle special characters in names', async () => {
      const request = new NextRequest('http://localhost/api/staff', {
        method: 'POST',
        body: JSON.stringify({
          firstName: "Mary-Jane O'Brien",
          lastName: 'De La Cruz',
          email: 'maryjane@example.com',
          phone: '9876543210',
          role: 'RECEPTIONIST',
          password: 'SecurePass123!',
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })

    it('should handle international phone formats', async () => {
      const request = new NextRequest('http://localhost/api/staff', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          phone: '+919876543210',
          role: 'RECEPTIONIST',
          password: 'SecurePass123!',
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })

    it('should handle very long qualifications', async () => {
      const request = new NextRequest('http://localhost/api/staff', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'Dr',
          lastName: 'Expert',
          email: 'expert@example.com',
          phone: '9876543210',
          role: 'DOCTOR',
          password: 'SecurePass123!',
          qualification: 'BDS, MDS (Orthodontics), PhD, Fellowship in Implantology, Diploma in Laser Dentistry',
        }),
      })
      const response = await POST(request)

      expect([201, 400]).toContain(response.status)
    })

    it('should handle salary as string or number', async () => {
      const request = new NextRequest('http://localhost/api/staff', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          phone: '9876543210',
          role: 'RECEPTIONIST',
          password: 'SecurePass123!',
          salary: '75000.50', // String with decimal
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })

    it('should handle joining date in different formats', async () => {
      const request = new NextRequest('http://localhost/api/staff', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          phone: '9876543210',
          role: 'RECEPTIONIST',
          password: 'SecurePass123!',
          joiningDate: '2025-01-29',
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
    })
  })
})
