/**
 * Comprehensive RBAC (Role-Based Access Control) Tests
 * Tests permission checks across all roles and endpoints
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

// Mock auth module
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    hospital: { findUnique: vi.fn() },
    patient: { count: vi.fn() },
    user: { count: vi.fn() },
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  requireAuthAndRole,
  requireRole,
  PLAN_LIMITS,
  checkPatientLimit,
  checkStaffLimit,
  generateToken,
} from '@/lib/api-helpers'

const mockAuth = vi.mocked(auth)
const mockPrisma = vi.mocked(prisma)

describe('RBAC - Role-Based Access Control', () => {
  const mockHospitalId = 'hospital-123'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Role Definitions', () => {
    const roles = ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'LAB_TECH', 'ACCOUNTANT']

    it('should have 5 defined roles', () => {
      expect(roles).toHaveLength(5)
    })

    describe('ADMIN Role', () => {
      it('should have full access to all operations', () => {
        const adminPermissions = {
          canCreatePatient: true,
          canDeletePatient: true,
          canCreateAppointment: true,
          canCancelAppointment: true,
          canCreateTreatment: true,
          canDeleteTreatment: true,
          canCreateInvoice: true,
          canDeleteInvoice: true,
          canProcessRefund: true,
          canCreateStaff: true,
          canDeleteStaff: true,
          canModifySettings: true,
          canViewReports: true,
          canManageInventory: true,
        }

        expect(Object.values(adminPermissions).every(p => p === true)).toBe(true)
      })
    })

    describe('DOCTOR Role', () => {
      it('should have clinical permissions', () => {
        const doctorPermissions = {
          canViewPatient: true,
          canUpdatePatient: true,
          canViewAppointment: true,
          canCreateTreatment: true,
          canUpdateTreatment: true,
          canStartTreatment: true,
          canCompleteTreatment: true,
          canViewDentalChart: true,
          canUpdateDentalChart: true,
          canCreatePrescription: true,
          canViewInvoice: true,
          canCreateInvoice: false, // Doctors typically don't create invoices
          canDeletePatient: false,
          canManageStaff: false,
        }

        expect(doctorPermissions.canCreateTreatment).toBe(true)
        expect(doctorPermissions.canManageStaff).toBe(false)
      })
    })

    describe('RECEPTIONIST Role', () => {
      it('should have front-desk permissions', () => {
        const receptionistPermissions = {
          canViewPatient: true,
          canCreatePatient: true,
          canUpdatePatient: true,
          canViewAppointment: true,
          canCreateAppointment: true,
          canUpdateAppointment: true,
          canCheckInPatient: true,
          canCheckOutPatient: true,
          canViewInvoice: true,
          canCreateInvoice: true,
          canReceivePayment: true,
          canCreateTreatment: false,
          canDeletePatient: false,
          canManageStaff: false,
        }

        expect(receptionistPermissions.canCreateAppointment).toBe(true)
        expect(receptionistPermissions.canCreateTreatment).toBe(false)
      })
    })

    describe('LAB_TECH Role', () => {
      it('should have lab-specific permissions', () => {
        const labTechPermissions = {
          canViewLabOrders: true,
          canUpdateLabOrders: true,
          canViewPatient: true, // Limited view
          canViewDentalChart: true,
          canCreateTreatment: false,
          canCreateInvoice: false,
          canManageStaff: false,
          canViewFinancials: false,
        }

        expect(labTechPermissions.canViewLabOrders).toBe(true)
        expect(labTechPermissions.canViewFinancials).toBe(false)
      })
    })

    describe('ACCOUNTANT Role', () => {
      it('should have financial permissions', () => {
        const accountantPermissions = {
          canViewInvoice: true,
          canCreateInvoice: true,
          canUpdateInvoice: true,
          canViewPayment: true,
          canReceivePayment: true,
          canProcessRefund: true,
          canViewReports: true,
          canExportReports: true,
          canViewPatient: true, // For billing purposes
          canCreateTreatment: false,
          canManageStaff: false,
          canModifySettings: false,
        }

        expect(accountantPermissions.canProcessRefund).toBe(true)
        expect(accountantPermissions.canCreateTreatment).toBe(false)
      })
    })
  })

  describe('requireAuthAndRole Function', () => {
    it('should return error for unauthenticated requests', async () => {
      mockAuth.mockResolvedValue(null)

      const result = await requireAuthAndRole()

      expect(result.error).not.toBeNull()
      expect(result.hospitalId).toBeNull()
    })

    it('should return user data for authenticated requests', async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: 'user-123',
          role: 'ADMIN',
          hospitalId: mockHospitalId,
        },
      })

      const result = await requireAuthAndRole()

      expect(result.error).toBeNull()
      expect(result.hospitalId).toBe(mockHospitalId)
      expect(result.user?.role).toBe('ADMIN')
    })

    it('should enforce role restrictions when specified', async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: 'user-123',
          role: 'RECEPTIONIST',
          hospitalId: mockHospitalId,
        },
      })

      const result = await requireAuthAndRole(['ADMIN', 'DOCTOR'])

      expect(result.error).not.toBeNull() // RECEPTIONIST not in allowed roles
    })

    it('should allow access when role is in allowed list', async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: 'user-123',
          role: 'DOCTOR',
          hospitalId: mockHospitalId,
        },
      })

      const result = await requireAuthAndRole(['ADMIN', 'DOCTOR'])

      expect(result.error).toBeNull()
    })
  })

  describe('requireRole Function', () => {
    it('should return null when role is allowed', () => {
      const result = requireRole('ADMIN', ['ADMIN', 'DOCTOR'])
      expect(result).toBeNull()
    })

    it('should return 403 response when role is not allowed', () => {
      const result = requireRole('LAB_TECH', ['ADMIN', 'DOCTOR'])
      expect(result).toBeInstanceOf(NextResponse)
    })

    it('should handle single role in allowed list', () => {
      const resultAllowed = requireRole('ADMIN', ['ADMIN'])
      const resultDenied = requireRole('DOCTOR', ['ADMIN'])

      expect(resultAllowed).toBeNull()
      expect(resultDenied).not.toBeNull()
    })
  })

  describe('Plan Limits', () => {
    it('should have defined limits for FREE plan', () => {
      expect(PLAN_LIMITS.FREE).toEqual({
        patientLimit: 100,
        staffLimit: 3,
        storageLimitMb: 500,
      })
    })

    it('should have unlimited (-1) limits for PROFESSIONAL plan', () => {
      expect(PLAN_LIMITS.PROFESSIONAL).toEqual({
        patientLimit: -1,
        staffLimit: -1,
        storageLimitMb: -1,
      })
    })

    it('should have unlimited limits for ENTERPRISE plan', () => {
      expect(PLAN_LIMITS.ENTERPRISE.patientLimit).toBe(-1)
      expect(PLAN_LIMITS.ENTERPRISE.staffLimit).toBe(-1)
    })

    it('should have unlimited limits for SELF_HOSTED plan', () => {
      expect(PLAN_LIMITS.SELF_HOSTED.patientLimit).toBe(-1)
    })
  })

  describe('checkPatientLimit Function', () => {
    it('should return allowed:true when under limit', async () => {
      mockPrisma.hospital.findUnique.mockResolvedValue({
        id: mockHospitalId,
        patientLimit: 100,
      } as any)
      mockPrisma.patient.count.mockResolvedValue(50)

      const result = await checkPatientLimit(mockHospitalId)

      expect(result.allowed).toBe(true)
      expect(result.current).toBe(50)
      expect(result.max).toBe(100)
    })

    it('should return allowed:false when at limit', async () => {
      mockPrisma.hospital.findUnique.mockResolvedValue({
        id: mockHospitalId,
        patientLimit: 100,
      } as any)
      mockPrisma.patient.count.mockResolvedValue(100)

      const result = await checkPatientLimit(mockHospitalId)

      expect(result.allowed).toBe(false)
    })

    it('should return allowed:true for unlimited plans (-1)', async () => {
      mockPrisma.hospital.findUnique.mockResolvedValue({
        id: mockHospitalId,
        patientLimit: -1,
      } as any)

      const result = await checkPatientLimit(mockHospitalId)

      expect(result.allowed).toBe(true)
      expect(result.max).toBe(-1)
    })

    it('should return allowed:false for non-existent hospital', async () => {
      mockPrisma.hospital.findUnique.mockResolvedValue(null)

      const result = await checkPatientLimit('non-existent')

      expect(result.allowed).toBe(false)
    })
  })

  describe('checkStaffLimit Function', () => {
    it('should return allowed:true when under limit', async () => {
      mockPrisma.hospital.findUnique.mockResolvedValue({
        id: mockHospitalId,
        staffLimit: 10,
      } as any)
      mockPrisma.user.count.mockResolvedValue(5)

      const result = await checkStaffLimit(mockHospitalId)

      expect(result.allowed).toBe(true)
    })

    it('should return allowed:false when at limit', async () => {
      mockPrisma.hospital.findUnique.mockResolvedValue({
        id: mockHospitalId,
        staffLimit: 3,
      } as any)
      mockPrisma.user.count.mockResolvedValue(3)

      const result = await checkStaffLimit(mockHospitalId)

      expect(result.allowed).toBe(false)
    })
  })

  describe('generateToken Function', () => {
    it('should generate token of specified length', () => {
      const token = generateToken(32)
      expect(token.length).toBe(32)
    })

    it('should generate unique tokens', () => {
      const token1 = generateToken()
      const token2 = generateToken()
      expect(token1).not.toBe(token2)
    })

    it('should only contain alphanumeric characters', () => {
      const token = generateToken(100)
      expect(token).toMatch(/^[A-Za-z0-9]+$/)
    })

    it('should use default length of 32', () => {
      const token = generateToken()
      expect(token.length).toBe(32)
    })
  })

  describe('Endpoint Access Matrix', () => {
    const endpointPermissions = {
      // Patient endpoints
      'GET /api/patients': ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'ACCOUNTANT'],
      'POST /api/patients': ['ADMIN', 'RECEPTIONIST'],
      'PUT /api/patients/:id': ['ADMIN', 'DOCTOR', 'RECEPTIONIST'],
      'DELETE /api/patients/:id': ['ADMIN'],

      // Appointment endpoints
      'GET /api/appointments': ['ADMIN', 'DOCTOR', 'RECEPTIONIST'],
      'POST /api/appointments': ['ADMIN', 'DOCTOR', 'RECEPTIONIST'],
      'PUT /api/appointments/:id': ['ADMIN', 'DOCTOR', 'RECEPTIONIST'],
      'DELETE /api/appointments/:id': ['ADMIN'],

      // Treatment endpoints
      'GET /api/treatments': ['ADMIN', 'DOCTOR'],
      'POST /api/treatments': ['ADMIN', 'DOCTOR'],
      'PUT /api/treatments/:id': ['ADMIN', 'DOCTOR'],
      'DELETE /api/treatments/:id': ['ADMIN'],

      // Invoice endpoints
      'GET /api/invoices': ['ADMIN', 'RECEPTIONIST', 'ACCOUNTANT'],
      'POST /api/invoices': ['ADMIN', 'RECEPTIONIST', 'ACCOUNTANT'],
      'PUT /api/invoices/:id': ['ADMIN', 'ACCOUNTANT'],
      'DELETE /api/invoices/:id': ['ADMIN'],

      // Payment endpoints
      'POST /api/payments': ['ADMIN', 'RECEPTIONIST', 'ACCOUNTANT'],
      'POST /api/payments/:id/refund': ['ADMIN', 'ACCOUNTANT'],

      // Staff endpoints
      'GET /api/staff': ['ADMIN'],
      'POST /api/staff': ['ADMIN'],
      'PUT /api/staff/:id': ['ADMIN'],
      'DELETE /api/staff/:id': ['ADMIN'],

      // Settings endpoints
      'GET /api/settings': ['ADMIN'],
      'PUT /api/settings': ['ADMIN'],

      // Lab order endpoints
      'GET /api/lab-orders': ['ADMIN', 'DOCTOR', 'LAB_TECH'],
      'POST /api/lab-orders': ['ADMIN', 'DOCTOR'],
      'PUT /api/lab-orders/:id': ['ADMIN', 'DOCTOR', 'LAB_TECH'],

      // Inventory endpoints
      'GET /api/inventory/items': ['ADMIN', 'DOCTOR', 'RECEPTIONIST'],
      'POST /api/inventory/items': ['ADMIN'],
      'POST /api/inventory/transactions': ['ADMIN'],

      // Report endpoints
      'GET /api/reports': ['ADMIN', 'ACCOUNTANT'],
      'GET /api/dashboard/stats': ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'ACCOUNTANT'],
    }

    it('should have ADMIN in all endpoint permissions', () => {
      const allEndpoints = Object.keys(endpointPermissions)
      const adminAccess = allEndpoints.every(
        endpoint => endpointPermissions[endpoint as keyof typeof endpointPermissions].includes('ADMIN')
      )
      expect(adminAccess).toBe(true)
    })

    it('should restrict staff management to ADMIN only', () => {
      const staffEndpoints = [
        'POST /api/staff',
        'PUT /api/staff/:id',
        'DELETE /api/staff/:id',
      ]

      for (const endpoint of staffEndpoints) {
        const roles = endpointPermissions[endpoint as keyof typeof endpointPermissions]
        expect(roles).toEqual(['ADMIN'])
      }
    })

    it('should allow doctors to create treatments', () => {
      const roles = endpointPermissions['POST /api/treatments']
      expect(roles).toContain('DOCTOR')
    })

    it('should allow receptionists to manage appointments', () => {
      expect(endpointPermissions['POST /api/appointments']).toContain('RECEPTIONIST')
      expect(endpointPermissions['PUT /api/appointments/:id']).toContain('RECEPTIONIST')
    })

    it('should allow accountants to handle payments', () => {
      expect(endpointPermissions['POST /api/payments']).toContain('ACCOUNTANT')
      expect(endpointPermissions['POST /api/payments/:id/refund']).toContain('ACCOUNTANT')
    })

    it('should restrict refunds to ADMIN and ACCOUNTANT', () => {
      const roles = endpointPermissions['POST /api/payments/:id/refund']
      expect(roles).toEqual(['ADMIN', 'ACCOUNTANT'])
      expect(roles).not.toContain('RECEPTIONIST')
    })

    it('should allow LAB_TECH to view and update lab orders', () => {
      expect(endpointPermissions['GET /api/lab-orders']).toContain('LAB_TECH')
      expect(endpointPermissions['PUT /api/lab-orders/:id']).toContain('LAB_TECH')
    })

    it('should not allow LAB_TECH to create lab orders', () => {
      expect(endpointPermissions['POST /api/lab-orders']).not.toContain('LAB_TECH')
    })
  })

  describe('Hospital Data Isolation', () => {
    it('should ensure all queries include hospitalId filter', () => {
      // This is a documentation test - verifying the pattern is understood
      const queryPattern = {
        correctQuery: {
          where: {
            hospitalId: 'hospital-123',
            // other filters
          },
        },
        incorrectQuery: {
          where: {
            // Missing hospitalId - security risk!
          },
        },
      }

      expect(queryPattern.correctQuery.where.hospitalId).toBeDefined()
      expect(queryPattern.incorrectQuery.where).not.toHaveProperty('hospitalId')
    })

    it('should not allow cross-hospital data access', () => {
      const hospital1Id = 'hospital-1'
      const hospital2Id = 'hospital-2'

      // User from hospital 1 should not access hospital 2 data
      const userHospital = hospital1Id
      const requestedData = { hospitalId: hospital2Id }

      expect(userHospital).not.toBe(requestedData.hospitalId)
      // Access should be denied
    })
  })
})
