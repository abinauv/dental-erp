import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, hasRole, hasMinimumRole, roleHierarchy } from '@/lib/auth'

// Better Auth replaced next-auth. The credential path keeps bcrypt (custom
// hash/verify) so existing password hashes keep working; these cover that and
// the role helpers. Full session/login behaviour needs a running DB and is
// verified manually on staging (see the migration checklist).

describe('Better Auth — password hashing (bcrypt preserved)', () => {
  it('hashes a password to a bcrypt hash and verifies it', async () => {
    const hash = await hashPassword('Secret123')
    expect(hash).not.toBe('Secret123')
    expect(hash.startsWith('$2')).toBe(true) // bcrypt prefix
    expect(await verifyPassword({ password: 'Secret123', hash })).toBe(true)
  })

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('Secret123')
    expect(await verifyPassword({ password: 'wrong', hash })).toBe(false)
  })

  it('verifies a pre-existing bcrypt hash (no reset needed on migration)', async () => {
    // A bcrypt hash of "password123" (cost 10), as an existing User.password
    // would hold and the backfilled BaAccount.password now carries.
    const legacy = '$2b$10$sO0esq1tX8wAWyiM884djOq3mehzetCLJsFBnBhOkYHhOdC6TLoue'
    expect(await verifyPassword({ password: 'password123', hash: legacy })).toBe(true)
    expect(await verifyPassword({ password: 'nope', hash: legacy })).toBe(false)
  })
})

describe('Better Auth — role helpers', () => {
  it('hasRole checks membership', () => {
    expect(hasRole('ADMIN', ['ADMIN', 'DOCTOR'])).toBe(true)
    expect(hasRole('RECEPTIONIST', ['ADMIN'])).toBe(false)
  })

  it('hasMinimumRole respects the hierarchy', () => {
    expect(hasMinimumRole('ADMIN', 'RECEPTIONIST')).toBe(true)
    expect(hasMinimumRole('LAB_TECH', 'ADMIN')).toBe(false)
    expect(roleHierarchy.ADMIN).toBeGreaterThan(roleHierarchy.DOCTOR)
  })
})

describe('Better Auth — route handler', () => {
  it('exposes GET and POST on the catch-all handler', async () => {
    const route = await import('@/app/api/auth/[...all]/route')
    expect(route.GET).toBeDefined()
    expect(route.POST).toBeDefined()
  })
})
