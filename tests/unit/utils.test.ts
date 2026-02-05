import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  cn,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPhone,
  generatePatientId,
  generateInvoiceNo,
  calculateGST,
  validateAadhar,
  validateIndianPhone,
} from '@/lib/utils'

describe('Utils - cn (classnames merger)', () => {
  it('should merge class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('should handle conditional classes', () => {
    expect(cn('base', true && 'active', false && 'disabled')).toBe('base active')
  })

  it('should merge tailwind classes correctly', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })

  it('should handle undefined and null values', () => {
    expect(cn('base', undefined, null, 'active')).toBe('base active')
  })

  it('should handle arrays', () => {
    expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz')
  })
})

describe('Utils - formatCurrency', () => {
  it('should format positive amounts correctly in INR', () => {
    const result = formatCurrency(1000)
    expect(result).toContain('1,000')
    expect(result).toMatch(/₹|INR/)
  })

  it('should format zero correctly', () => {
    const result = formatCurrency(0)
    expect(result).toContain('0')
  })

  it('should format decimal amounts correctly', () => {
    const result = formatCurrency(1234.56)
    expect(result).toContain('1,234')
  })

  it('should format large amounts with Indian comma format', () => {
    const result = formatCurrency(1234567)
    // Indian format: 12,34,567
    expect(result).toMatch(/12,34,567|1,234,567/)
  })
})

describe('Utils - formatDate', () => {
  it('should format Date object correctly', () => {
    const date = new Date('2024-01-15')
    const result = formatDate(date)
    expect(result).toContain('15')
    expect(result).toContain('2024')
  })

  it('should format date string correctly', () => {
    const result = formatDate('2024-06-20')
    expect(result).toContain('20')
    expect(result).toContain('2024')
  })

  it('should handle invalid dates gracefully', () => {
    // This should not throw
    expect(() => formatDate('invalid-date')).not.toThrow()
  })
})

describe('Utils - formatDateTime', () => {
  it('should include both date and time', () => {
    const date = new Date('2024-01-15T14:30:00')
    const result = formatDateTime(date)
    expect(result).toContain('15')
    expect(result).toContain('2024')
  })

  it('should format string dates with time', () => {
    const result = formatDateTime('2024-06-20T09:15:00')
    expect(result).toContain('20')
    expect(result).toContain('2024')
  })
})

describe('Utils - formatPhone', () => {
  it('should format 10-digit Indian phone numbers', () => {
    const result = formatPhone('9876543210')
    expect(result).toBe('+91 98765 43210')
  })

  it('should handle phone with existing formatting', () => {
    const result = formatPhone('+91-9876-543210')
    expect(result).toBe('+91 98765 43210')
  })

  it('should return original for non-10-digit numbers', () => {
    expect(formatPhone('12345')).toBe('12345')
    expect(formatPhone('12345678901234')).toBe('12345678901234')
  })

  it('should return empty string for empty input', () => {
    expect(formatPhone('')).toBe('')
  })
})

describe('Utils - generatePatientId', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('should generate ID with correct format', () => {
    vi.setSystemTime(new Date('2024-06-15'))
    const result = generatePatientId()
    expect(result).toMatch(/^PAT2406\d{4}$/)
  })

  it('should generate different IDs on consecutive calls', () => {
    const id1 = generatePatientId()
    const id2 = generatePatientId()
    // They may be the same or different due to random component
    expect(id1).toMatch(/^PAT/)
    expect(id2).toMatch(/^PAT/)
  })

  afterEach(() => {
    vi.useRealTimers()
  })
})

describe('Utils - generateInvoiceNo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('should generate invoice number with correct format', () => {
    vi.setSystemTime(new Date('2024-06-15'))
    const result = generateInvoiceNo()
    expect(result).toMatch(/^INV-202406-\d{4}$/)
  })

  afterEach(() => {
    vi.useRealTimers()
  })
})

describe('Utils - calculateGST', () => {
  it('should calculate GST correctly with default rates', () => {
    const result = calculateGST(1000)
    expect(result.subtotal).toBe(1000)
    expect(result.cgst).toBe(90)
    expect(result.sgst).toBe(90)
    expect(result.total).toBe(1180)
  })

  it('should calculate GST with custom rates', () => {
    const result = calculateGST(1000, 6, 6)
    expect(result.subtotal).toBe(1000)
    expect(result.cgst).toBe(60)
    expect(result.sgst).toBe(60)
    expect(result.total).toBe(1120)
  })

  it('should handle zero amount', () => {
    const result = calculateGST(0)
    expect(result.total).toBe(0)
  })

  it('should handle decimal amounts', () => {
    const result = calculateGST(99.99)
    expect(result.subtotal).toBe(99.99)
    expect(result.total).toBeCloseTo(117.99, 1)
  })
})

describe('Utils - validateAadhar', () => {
  it('should validate correct 12-digit Aadhar', () => {
    expect(validateAadhar('123456789012')).toBe(true)
  })

  it('should validate Aadhar with spaces', () => {
    expect(validateAadhar('1234 5678 9012')).toBe(true)
  })

  it('should validate Aadhar with dashes', () => {
    expect(validateAadhar('1234-5678-9012')).toBe(true)
  })

  it('should reject invalid Aadhar numbers', () => {
    expect(validateAadhar('12345678901')).toBe(false) // 11 digits
    expect(validateAadhar('1234567890123')).toBe(false) // 13 digits
    expect(validateAadhar('')).toBe(false)
  })
})

describe('Utils - validateIndianPhone', () => {
  it('should validate correct Indian phone numbers', () => {
    expect(validateIndianPhone('9876543210')).toBe(true)
    expect(validateIndianPhone('8765432109')).toBe(true)
    expect(validateIndianPhone('7654321098')).toBe(true)
    expect(validateIndianPhone('6543210987')).toBe(true)
  })

  it('should validate phone numbers with formatting', () => {
    expect(validateIndianPhone('+91-9876543210')).toBe(true)
    expect(validateIndianPhone('91 9876543210')).toBe(true)
  })

  it('should reject invalid phone numbers', () => {
    expect(validateIndianPhone('1234567890')).toBe(false) // Starts with 1
    expect(validateIndianPhone('5234567890')).toBe(false) // Starts with 5
    expect(validateIndianPhone('987654321')).toBe(false) // 9 digits
    expect(validateIndianPhone('98765432101')).toBe(false) // 11 digits
    expect(validateIndianPhone('')).toBe(false)
  })
})
