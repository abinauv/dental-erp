import { describe, it, expect } from 'vitest'
import { generateOTP } from '@/lib/patient-auth'

describe('generateOTP()', () => {
  it('returns a 6-digit string', () => {
    const otp = generateOTP()
    expect(otp).toMatch(/^\d{6}$/)
  })

  it('is always 6 digits (no leading zero loss)', () => {
    for (let i = 0; i < 50; i++) {
      const otp = generateOTP()
      expect(otp).toHaveLength(6)
      expect(parseInt(otp)).toBeGreaterThanOrEqual(100000)
      expect(parseInt(otp)).toBeLessThan(1000000)
    }
  })

  it('generates varying OTPs (not constant)', () => {
    const otps = new Set(Array.from({ length: 20 }, () => generateOTP()))
    expect(otps.size).toBeGreaterThan(1)
  })
})
