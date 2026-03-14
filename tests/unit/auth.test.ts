// @ts-nocheck
import { describe, it, expect, vi } from 'vitest'

// Mock NextAuth and dependencies so the module loads without DB
vi.mock('next-auth', () => ({
  default: vi.fn(() => ({
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    handlers: {},
  })),
}))
vi.mock('next-auth/providers/credentials', () => ({
  default: vi.fn(() => ({})),
}))
vi.mock('bcryptjs', () => ({
  default: { compare: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: vi.fn() } },
}))
vi.mock('@/lib/auth.config', () => ({
  authConfig: { providers: [], callbacks: {} },
}))

import { hasRole, hasMinimumRole, roleHierarchy } from '@/lib/auth'

describe('roleHierarchy', () => {
  it('defines 5 roles', () => {
    expect(Object.keys(roleHierarchy)).toHaveLength(5)
  })

  it('ADMIN has highest level (5)', () => {
    expect(roleHierarchy['ADMIN']).toBe(5)
  })

  it('DOCTOR is level 4', () => {
    expect(roleHierarchy['DOCTOR']).toBe(4)
  })

  it('ACCOUNTANT is level 3', () => {
    expect(roleHierarchy['ACCOUNTANT']).toBe(3)
  })

  it('RECEPTIONIST is level 2', () => {
    expect(roleHierarchy['RECEPTIONIST']).toBe(2)
  })

  it('LAB_TECH is level 1', () => {
    expect(roleHierarchy['LAB_TECH']).toBe(1)
  })

  it('ADMIN > DOCTOR > ACCOUNTANT > RECEPTIONIST > LAB_TECH', () => {
    expect(roleHierarchy['ADMIN']).toBeGreaterThan(roleHierarchy['DOCTOR'])
    expect(roleHierarchy['DOCTOR']).toBeGreaterThan(roleHierarchy['ACCOUNTANT'])
    expect(roleHierarchy['ACCOUNTANT']).toBeGreaterThan(roleHierarchy['RECEPTIONIST'])
    expect(roleHierarchy['RECEPTIONIST']).toBeGreaterThan(roleHierarchy['LAB_TECH'])
  })
})

describe('hasRole', () => {
  it('returns true when role is in allowed list', () => {
    expect(hasRole('ADMIN', ['ADMIN', 'DOCTOR'])).toBe(true)
  })

  it('returns false when role is not in allowed list', () => {
    expect(hasRole('LAB_TECH', ['ADMIN', 'DOCTOR'])).toBe(false)
  })

  it('returns true for single matching role', () => {
    expect(hasRole('DOCTOR', ['DOCTOR'])).toBe(true)
  })

  it('returns false for empty allowed list', () => {
    expect(hasRole('ADMIN', [])).toBe(false)
  })

  it('is case-sensitive', () => {
    expect(hasRole('admin', ['ADMIN'])).toBe(false)
  })

  it('works for all defined roles', () => {
    const allRoles = Object.keys(roleHierarchy)
    allRoles.forEach((role) => {
      expect(hasRole(role, allRoles)).toBe(true)
    })
  })
})

describe('hasMinimumRole', () => {
  it('ADMIN meets minimum ADMIN', () => {
    expect(hasMinimumRole('ADMIN', 'ADMIN')).toBe(true)
  })

  it('ADMIN meets minimum DOCTOR', () => {
    expect(hasMinimumRole('ADMIN', 'DOCTOR')).toBe(true)
  })

  it('ADMIN meets minimum LAB_TECH', () => {
    expect(hasMinimumRole('ADMIN', 'LAB_TECH')).toBe(true)
  })

  it('LAB_TECH does not meet minimum ADMIN', () => {
    expect(hasMinimumRole('LAB_TECH', 'ADMIN')).toBe(false)
  })

  it('LAB_TECH does not meet minimum DOCTOR', () => {
    expect(hasMinimumRole('LAB_TECH', 'DOCTOR')).toBe(false)
  })

  it('DOCTOR meets minimum DOCTOR (equal)', () => {
    expect(hasMinimumRole('DOCTOR', 'DOCTOR')).toBe(true)
  })

  it('RECEPTIONIST meets minimum RECEPTIONIST', () => {
    expect(hasMinimumRole('RECEPTIONIST', 'RECEPTIONIST')).toBe(true)
  })

  it('RECEPTIONIST does not meet minimum ACCOUNTANT', () => {
    expect(hasMinimumRole('RECEPTIONIST', 'ACCOUNTANT')).toBe(false)
  })

  it('unknown role defaults to 0', () => {
    expect(hasMinimumRole('UNKNOWN', 'LAB_TECH')).toBe(false)
  })

  it('any role meets unknown minimum (defaults to 0)', () => {
    expect(hasMinimumRole('LAB_TECH', 'UNKNOWN')).toBe(true)
  })

  it('unknown vs unknown returns true (both 0)', () => {
    expect(hasMinimumRole('FAKE', 'FAKE2')).toBe(true)
  })
})
