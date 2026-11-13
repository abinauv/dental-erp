// Invite and email-verification tokens come from the CSPRNG.
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: { api: {} } }))
vi.mock('@/lib/prisma', () => ({ prisma: {}, default: {} }))

import { generateToken } from '@/lib/api-helpers'

afterEach(() => vi.restoreAllMocks())

describe('generateToken', () => {
  it('never uses Math.random', () => {
    const random = vi.spyOn(Math, 'random')
    generateToken(64)
    expect(random).not.toHaveBeenCalled()
  })

  it('returns the requested number of letters and digits, different each time', () => {
    const a = generateToken(32)
    const b = generateToken(32)
    expect(a).toMatch(/^[A-Za-z0-9]{32}$/)
    expect(b).toMatch(/^[A-Za-z0-9]{32}$/)
    expect(a).not.toBe(b)
  })
})
