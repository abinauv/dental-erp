import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

const { generateOTP, hashOTP, otpMatches, createPatientToken } = await import('@/lib/patient-auth')

const env = { ...process.env }
afterEach(() => {
  process.env = { ...env }
  vi.restoreAllMocks()
})

describe('generateOTP', () => {
  it('always returns six digits', () => {
    for (let i = 0; i < 2000; i++) expect(generateOTP()).toMatch(/^[1-9]\d{5}$/)
  })

  it('does not use Math.random, which is predictable from earlier codes', () => {
    const random = vi.spyOn(Math, 'random')
    generateOTP()
    expect(random).not.toHaveBeenCalled()
  })
})

describe('hashOTP / otpMatches', () => {
  it('stores a keyed hash, not the code', () => {
    const stored = hashOTP('123456', 'h1', '9876543210')
    expect(stored).toMatch(/^[0-9a-f]{64}$/)
    expect(otpMatches('123456', stored, 'h1', '9876543210')).toBe(true)
  })

  it('rejects a wrong code, another phone, or another clinic', () => {
    const stored = hashOTP('123456', 'h1', '9876543210')
    expect(otpMatches('123457', stored, 'h1', '9876543210')).toBe(false)
    expect(otpMatches('123456', stored, 'h1', '9876500000')).toBe(false)
    expect(otpMatches('123456', stored, 'h2', '9876543210')).toBe(false)
    expect(otpMatches('123456', '123456', 'h1', '9876543210')).toBe(false)
  })

  it('depends on the server secret, so a database dump alone is not enough', () => {
    process.env.NEXTAUTH_SECRET = 'secret-a'
    const a = hashOTP('123456', 'h1', '9876543210')
    process.env.NEXTAUTH_SECRET = 'secret-b'
    expect(hashOTP('123456', 'h1', '9876543210')).not.toBe(a)
  })
})

describe('the patient-portal secret in production', () => {
  it('refuses to hash or sign without NEXTAUTH_SECRET instead of using the built-in fallback', async () => {
    delete process.env.NEXTAUTH_SECRET
    vi.stubEnv('NODE_ENV', 'production')

    expect(() => hashOTP('123456', 'h1', '9876543210')).toThrow('NEXTAUTH_SECRET')
    await expect(
      createPatientToken({ patientId: 'p1', hospitalId: 'h1', phone: '9876543210' })
    ).rejects.toThrow('NEXTAUTH_SECRET')
    vi.unstubAllEnvs()
  })
})
