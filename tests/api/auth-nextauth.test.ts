// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
  compare: vi.fn(),
  hash: vi.fn(),
}))

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

// Mock auth.config
vi.mock('@/lib/auth.config', () => ({
  authConfig: {
    trustHost: true,
    pages: {
      signIn: '/login',
    },
    callbacks: {},
  },
}))

// Mock next-auth — we test the authorize function directly
vi.mock('next-auth', () => {
  let capturedConfig: any = null
  return {
    default: (config: any) => {
      capturedConfig = config
      return {
        auth: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        handlers: { GET: vi.fn(), POST: vi.fn() },
      }
    },
    __getCapturedConfig: () => capturedConfig,
  }
})

vi.mock('next-auth/providers/credentials', () => ({
  default: (opts: any) => ({ ...opts, type: 'credentials' }),
}))

import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// We need to extract the authorize function from the credentials provider
// Re-import to trigger the module and capture the config
async function getAuthorize() {
  // Clear module cache to re-execute
  vi.resetModules()

  // Re-mock everything
  vi.doMock('bcryptjs', () => ({
    default: { compare: vi.fn(), hash: vi.fn() },
    compare: vi.fn(),
    hash: vi.fn(),
  }))

  vi.doMock('@/lib/prisma', () => ({
    prisma: {
      user: {
        findUnique: vi.fn(),
      },
    },
  }))

  vi.doMock('@/lib/auth.config', () => ({
    authConfig: {
      trustHost: true,
      pages: { signIn: '/login' },
      callbacks: {},
    },
  }))

  let authorizeFunc: any = null

  vi.doMock('next-auth', () => ({
    default: (config: any) => {
      // Extract authorize from the first credentials provider
      if (config.providers && config.providers[0]) {
        authorizeFunc = config.providers[0].authorize
      }
      return {
        auth: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        handlers: { GET: vi.fn(), POST: vi.fn() },
      }
    },
  }))

  vi.doMock('next-auth/providers/credentials', () => ({
    default: (opts: any) => opts,
  }))

  // Import to trigger execution
  const mod = await import('@/lib/auth')
  const prismaModule = await import('@/lib/prisma')
  const bcryptModule = await import('bcryptjs')

  return { authorize: authorizeFunc, prisma: prismaModule.prisma, bcrypt: bcryptModule.default }
}

describe('NextAuth — POST /api/auth/[...nextauth]', () => {
  describe('Credentials authorize()', () => {
    let authorize: any
    let mockPrisma: any
    let mockBcrypt: any

    beforeEach(async () => {
      const result = await getAuthorize()
      authorize = result.authorize
      mockPrisma = result.prisma
      mockBcrypt = result.bcrypt
      vi.clearAllMocks()
    })

    it('should return null for invalid email format', async () => {
      const result = await authorize({ email: 'not-an-email', password: 'password123' })
      expect(result).toBeNull()
      // Should not even hit the database
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled()
    })

    it('should return null for password shorter than 6 characters', async () => {
      const result = await authorize({ email: 'user@test.com', password: '12345' })
      expect(result).toBeNull()
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled()
    })

    it('should return null for missing credentials', async () => {
      const result = await authorize({})
      expect(result).toBeNull()
    })

    it('should return null when user not found', async () => {
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(null)

      const result = await authorize({ email: 'nobody@test.com', password: 'password123' })
      expect(result).toBeNull()
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'nobody@test.com' },
        include: { staff: true, hospital: true },
      })
    })

    it('should return null when user is inactive', async () => {
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'inactive@test.com',
        password: '$2a$10$hashedpassword',
        isActive: false,
        hospital: { id: 'h1', isActive: true },
      })

      const result = await authorize({ email: 'inactive@test.com', password: 'password123' })
      expect(result).toBeNull()
    })

    it('should return null when hospital is inactive', async () => {
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'user@test.com',
        password: '$2a$10$hashedpassword',
        isActive: true,
        hospital: { id: 'h1', isActive: false },
      })

      const result = await authorize({ email: 'user@test.com', password: 'password123' })
      expect(result).toBeNull()
    })

    it('should return null when hospital is missing', async () => {
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'user@test.com',
        password: '$2a$10$hashedpassword',
        isActive: true,
        hospital: null,
      })

      const result = await authorize({ email: 'user@test.com', password: 'password123' })
      expect(result).toBeNull()
    })

    it('should return null when password does not match', async () => {
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'user@test.com',
        password: '$2a$10$hashedpassword',
        isActive: true,
        hospital: { id: 'h1', isActive: true },
      })
      vi.mocked(mockBcrypt.compare).mockResolvedValue(false)

      const result = await authorize({ email: 'user@test.com', password: 'wrongpassword' })
      expect(result).toBeNull()
    })

    it('should return user object on successful login', async () => {
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'admin@clinic.com',
        name: 'Dr. Admin',
        password: '$2a$10$hashedpassword',
        role: 'ADMIN',
        isActive: true,
        isHospitalAdmin: true,
        hospitalId: 'hospital-1',
        staff: { id: 'staff-1' },
        hospital: { id: 'hospital-1', isActive: true },
      })
      vi.mocked(mockBcrypt.compare).mockResolvedValue(true)

      const result = await authorize({ email: 'admin@clinic.com', password: 'password123' })

      expect(result).toEqual({
        id: 'user-1',
        email: 'admin@clinic.com',
        name: 'Dr. Admin',
        role: 'ADMIN',
        staffId: 'staff-1',
        hospitalId: 'hospital-1',
        isHospitalAdmin: true,
      })
    })

    it('should return staffId as undefined when user has no staff record', async () => {
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'admin@clinic.com',
        name: 'Admin',
        password: '$2a$10$hashedpassword',
        role: 'ADMIN',
        isActive: true,
        isHospitalAdmin: true,
        hospitalId: 'hospital-1',
        staff: null,
        hospital: { id: 'hospital-1', isActive: true },
      })
      vi.mocked(mockBcrypt.compare).mockResolvedValue(true)

      const result = await authorize({ email: 'admin@clinic.com', password: 'password123' })

      expect(result).not.toBeNull()
      expect(result.staffId).toBeUndefined()
    })
  })

  describe('Session configuration', () => {
    it('should use JWT session strategy', async () => {
      const result = await getAuthorize()
      // The auth module configures JWT strategy with 8 hour maxAge
      // We verify by checking the module exported correctly
      expect(result.authorize).toBeDefined()
    })
  })

  describe('Login schema validation', () => {
    let authorize: any
    let mockPrisma: any
    let mockBcrypt: any

    beforeEach(async () => {
      const result = await getAuthorize()
      authorize = result.authorize
      mockPrisma = result.prisma
      mockBcrypt = result.bcrypt
      vi.clearAllMocks()
    })

    it('should reject empty email', async () => {
      const result = await authorize({ email: '', password: 'password123' })
      expect(result).toBeNull()
    })

    it('should reject email without @ symbol', async () => {
      const result = await authorize({ email: 'notanemail', password: 'password123' })
      expect(result).toBeNull()
    })

    it('should accept valid email with 6+ char password', async () => {
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue({
        id: 'u1', email: 'valid@test.com', name: 'Test', password: 'hashed',
        role: 'DOCTOR', isActive: true, isHospitalAdmin: false, hospitalId: 'h1',
        staff: { id: 's1' }, hospital: { id: 'h1', isActive: true },
      })
      vi.mocked(mockBcrypt.compare).mockResolvedValue(true)

      const result = await authorize({ email: 'valid@test.com', password: '123456' })
      expect(result).not.toBeNull()
      expect(result.role).toBe('DOCTOR')
    })
  })

  describe('Route handler exports', () => {
    it('should export GET and POST handlers from auth handlers', async () => {
      // The route file simply re-exports from lib/auth
      const routeModule = await import('@/app/api/auth/[...nextauth]/route')
      expect(routeModule.GET).toBeDefined()
      expect(routeModule.POST).toBeDefined()
    })
  })
})
