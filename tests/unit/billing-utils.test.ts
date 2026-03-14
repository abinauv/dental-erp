import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  calculateGST,
  calculateDiscount,
  calculateInvoiceTotals,
  formatCurrency,
  formatDate,
  formatDateTime,
  calculateBalance,
  isInvoiceOverdue,
  getDueDays,
  calculateDueDate,
  numberToWords,
  getDateRangeFromPreset,
  getPatientName,
  gstConfig,
} from '@/lib/billing-utils'

describe('Billing Utils - calculateGST', () => {
  it('should calculate GST with default rates', () => {
    const result = calculateGST(1000)
    expect(result.subtotal).toBe(1000)
    expect(result.cgstAmount).toBe(90)
    expect(result.sgstAmount).toBe(90)
    expect(result.totalTax).toBe(180)
    expect(result.grandTotal).toBe(1180)
  })

  it('should calculate GST with custom rates', () => {
    const result = calculateGST(1000, 6, 6)
    expect(result.cgstAmount).toBe(60)
    expect(result.sgstAmount).toBe(60)
    expect(result.totalTax).toBe(120)
    expect(result.grandTotal).toBe(1120)
  })

  it('should handle zero subtotal', () => {
    const result = calculateGST(0)
    expect(result.grandTotal).toBe(0)
    expect(result.totalTax).toBe(0)
  })

  it('should round to 2 decimal places', () => {
    const result = calculateGST(99.99)
    expect(result.cgstAmount).toBe(9)
    expect(result.grandTotal).toBeCloseTo(117.99, 2)
  })

  it('should handle large amounts', () => {
    const result = calculateGST(1000000)
    expect(result.totalTax).toBe(180000)
    expect(result.grandTotal).toBe(1180000)
  })
})

describe('Billing Utils - calculateDiscount', () => {
  it('should calculate percentage discount correctly', () => {
    const result = calculateDiscount(1000, 'PERCENTAGE', 10)
    expect(result.discountAmount).toBe(100)
    expect(result.afterDiscount).toBe(900)
  })

  it('should calculate fixed discount correctly', () => {
    const result = calculateDiscount(1000, 'FIXED', 150)
    expect(result.discountAmount).toBe(150)
    expect(result.afterDiscount).toBe(850)
  })

  it('should cap discount at subtotal', () => {
    const result = calculateDiscount(100, 'FIXED', 150)
    expect(result.discountAmount).toBe(100)
    expect(result.afterDiscount).toBe(0)
  })

  it('should handle zero discount', () => {
    const result = calculateDiscount(1000, 'PERCENTAGE', 0)
    expect(result.discountAmount).toBe(0)
    expect(result.afterDiscount).toBe(1000)
  })

  it('should handle 100% discount', () => {
    const result = calculateDiscount(1000, 'PERCENTAGE', 100)
    expect(result.discountAmount).toBe(1000)
    expect(result.afterDiscount).toBe(0)
  })
})

describe('Billing Utils - calculateInvoiceTotals', () => {
  it('should calculate totals for taxable items', () => {
    const items = [
      { quantity: 1, unitPrice: 500, taxable: true },
      { quantity: 2, unitPrice: 250, taxable: true },
    ]
    const result = calculateInvoiceTotals(items)

    expect(result.subtotal).toBe(1000)
    expect(result.taxableAmount).toBe(1000)
    expect(result.nonTaxableAmount).toBe(0)
    expect(result.totalTax).toBe(180)
    expect(result.totalAmount).toBe(1180)
  })

  it('should calculate totals for mixed taxable/non-taxable items', () => {
    const items = [
      { quantity: 1, unitPrice: 500, taxable: true },
      { quantity: 1, unitPrice: 500, taxable: false },
    ]
    const result = calculateInvoiceTotals(items)

    expect(result.subtotal).toBe(1000)
    expect(result.taxableAmount).toBe(500)
    expect(result.nonTaxableAmount).toBe(500)
    expect(result.totalTax).toBe(90) // 18% of 500
    expect(result.totalAmount).toBe(1090)
  })

  it('should apply discount before tax calculation', () => {
    const items = [
      { quantity: 1, unitPrice: 1000, taxable: true },
    ]
    const result = calculateInvoiceTotals(items, 'FIXED', 100)

    expect(result.subtotal).toBe(1000)
    expect(result.discountAmount).toBe(100)
    expect(result.taxableAmount).toBe(900)
    expect(result.totalTax).toBe(162) // 18% of 900
    expect(result.totalAmount).toBe(1062)
  })

  it('should handle empty items array', () => {
    const result = calculateInvoiceTotals([])
    expect(result.subtotal).toBe(0)
    expect(result.totalAmount).toBe(0)
  })
})

describe('Billing Utils - formatCurrency', () => {
  it('should format positive amounts in INR', () => {
    const result = formatCurrency(1234.56)
    expect(result).toContain('1,234.56')
    expect(result).toContain('₹')
  })

  it('should handle null/undefined', () => {
    expect(formatCurrency(null)).toBe('₹0.00')
    expect(formatCurrency(undefined)).toBe('₹0.00')
  })

  it('should handle string amounts', () => {
    expect(formatCurrency('1234.56')).toContain('1,234.56')
  })

  it('should handle invalid string amounts', () => {
    expect(formatCurrency('invalid')).toBe('₹0.00')
  })

  it('should format zero correctly', () => {
    expect(formatCurrency(0)).toContain('0.00')
  })
})

describe('Billing Utils - formatDate', () => {
  it('should format Date object', () => {
    const result = formatDate(new Date('2024-01-15'))
    expect(result).toContain('15')
    expect(result).toContain('2024')
  })

  it('should format date string', () => {
    const result = formatDate('2024-06-20')
    expect(result).toContain('20')
    expect(result).toContain('2024')
  })

  it('should handle null/undefined', () => {
    expect(formatDate(null)).toBe('-')
    expect(formatDate(undefined)).toBe('-')
  })
})

describe('Billing Utils - formatDateTime', () => {
  it('should format Date with time', () => {
    const result = formatDateTime(new Date('2024-01-15T14:30:00'))
    expect(result).toContain('15')
    expect(result).toContain('2024')
  })

  it('should handle null/undefined', () => {
    expect(formatDateTime(null)).toBe('-')
    expect(formatDateTime(undefined)).toBe('-')
  })
})

describe('Billing Utils - calculateBalance', () => {
  it('should calculate balance correctly', () => {
    expect(calculateBalance(1000, 300)).toBe(700)
    expect(calculateBalance(1000, 1000)).toBe(0)
    expect(calculateBalance(1000, 0)).toBe(1000)
  })

  it('should handle overpayment', () => {
    expect(calculateBalance(1000, 1200)).toBe(-200)
  })

  it('should round to 2 decimal places', () => {
    expect(calculateBalance(100.555, 50.222)).toBeCloseTo(50.33, 2)
  })
})

describe('Billing Utils - isInvoiceOverdue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return true for past due dates', () => {
    expect(isInvoiceOverdue('2024-06-10', 'PENDING')).toBe(true)
    expect(isInvoiceOverdue(new Date('2024-06-14'), 'PENDING')).toBe(true)
  })

  it('should return false for future due dates', () => {
    expect(isInvoiceOverdue('2024-06-20', 'PENDING')).toBe(false)
  })

  it('should return false for paid invoices', () => {
    expect(isInvoiceOverdue('2024-06-10', 'PAID')).toBe(false)
  })

  it('should return false for cancelled invoices', () => {
    expect(isInvoiceOverdue('2024-06-10', 'CANCELLED')).toBe(false)
  })

  it('should return false for refunded invoices', () => {
    expect(isInvoiceOverdue('2024-06-10', 'REFUNDED')).toBe(false)
  })

  it('should return false for null due date', () => {
    expect(isInvoiceOverdue(null, 'PENDING')).toBe(false)
  })
})

describe('Billing Utils - getDueDays', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return overdue days for past dates', () => {
    const result = getDueDays('2024-06-10')
    expect(result.isOverdue).toBe(true)
    expect(result.days).toBe(5)
    expect(result.label).toBe('5 days overdue')
  })

  it('should return days until due for future dates', () => {
    const result = getDueDays('2024-06-20')
    expect(result.isOverdue).toBe(false)
    expect(result.days).toBe(5)
    expect(result.label).toBe('Due in 5 days')
  })

  it('should handle due today', () => {
    const result = getDueDays('2024-06-15')
    expect(result.isOverdue).toBe(false)
    expect(result.days).toBe(0)
    expect(result.label).toBe('Due today')
  })

  it('should handle null due date', () => {
    const result = getDueDays(null)
    expect(result.label).toBe('No due date')
  })
})

describe('Billing Utils - calculateDueDate', () => {
  it('should calculate due date correctly', () => {
    const invoiceDate = new Date('2024-06-15')
    const dueDate = calculateDueDate(invoiceDate, 30)
    expect(dueDate.getFullYear()).toBe(2024)
    expect(dueDate.getMonth()).toBe(6) // July (0-indexed)
    expect(dueDate.getDate()).toBe(15)
  })

  it('should handle zero days', () => {
    const invoiceDate = new Date('2024-06-15')
    const dueDate = calculateDueDate(invoiceDate, 0)
    expect(dueDate.getDate()).toBe(15)
    expect(dueDate.getMonth()).toBe(5) // June
  })

  it('should handle month overflow', () => {
    const invoiceDate = new Date('2024-12-25')
    const dueDate = calculateDueDate(invoiceDate, 15)
    expect(dueDate.getFullYear()).toBe(2025)
    expect(dueDate.getMonth()).toBe(0) // January
    expect(dueDate.getDate()).toBe(9)
  })
})

describe('Billing Utils - numberToWords', () => {
  it('should convert zero', () => {
    expect(numberToWords(0)).toBe('Zero')
  })

  it('should convert small numbers', () => {
    expect(numberToWords(5)).toBe('Five Rupees Only')
    expect(numberToWords(15)).toBe('Fifteen Rupees Only')
    expect(numberToWords(99)).toBe('Ninety Nine Rupees Only')
  })

  it('should convert hundreds', () => {
    expect(numberToWords(100)).toBe('One Hundred Rupees Only')
    expect(numberToWords(500)).toBe('Five Hundred Rupees Only')
    expect(numberToWords(999)).toBe('Nine Hundred Ninety Nine Rupees Only')
  })

  it('should convert thousands (Indian format)', () => {
    expect(numberToWords(1000)).toBe('One Thousand Rupees Only')
    expect(numberToWords(50000)).toBe('Fifty Thousand Rupees Only')
  })

  it('should convert lakhs (Indian format)', () => {
    expect(numberToWords(100000)).toBe('One Lakh Rupees Only')
    expect(numberToWords(500000)).toBe('Five Lakh Rupees Only')
  })

  it('should convert crores (Indian format)', () => {
    expect(numberToWords(10000000)).toBe('One Crore Rupees Only')
  })

  it('should handle decimal amounts (paise)', () => {
    const result = numberToWords(100.50)
    expect(result).toContain('One Hundred Rupees')
    expect(result).toContain('Fifty Paise')
  })
})

describe('Billing Utils - getDateRangeFromPreset', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T10:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return today range', () => {
    const { startDate, endDate } = getDateRangeFromPreset('today')
    expect(startDate.getDate()).toBe(15)
    expect(startDate.getHours()).toBe(0)
    expect(endDate.getDate()).toBe(15)
    expect(endDate.getHours()).toBe(23)
  })

  it('should return yesterday range', () => {
    const { startDate, endDate } = getDateRangeFromPreset('yesterday')
    expect(startDate.getDate()).toBe(14)
    expect(endDate.getDate()).toBe(14)
  })

  it('should return this_week range', () => {
    const { startDate, endDate } = getDateRangeFromPreset('this_week')
    expect(startDate.getDay()).toBe(0) // Sunday
    expect(endDate.getDate()).toBe(15)
  })

  it('should return this_month range', () => {
    const { startDate, endDate } = getDateRangeFromPreset('this_month')
    expect(startDate.getDate()).toBe(1)
    expect(startDate.getMonth()).toBe(5) // June
    expect(endDate.getMonth()).toBe(5)
  })

  it('should return last_month range', () => {
    const { startDate, endDate } = getDateRangeFromPreset('last_month')
    expect(startDate.getMonth()).toBe(4) // May
    expect(startDate.getDate()).toBe(1)
    expect(endDate.getMonth()).toBe(4)
    expect(endDate.getDate()).toBe(31)
  })

  it('should return this_year range', () => {
    const { startDate, endDate } = getDateRangeFromPreset('this_year')
    expect(startDate.getMonth()).toBe(0) // January
    expect(startDate.getDate()).toBe(1)
    expect(startDate.getFullYear()).toBe(2024)
  })
})

describe('Billing Utils - getPatientName', () => {
  it('should return full name', () => {
    const patient = { firstName: 'John', lastName: 'Doe' }
    expect(getPatientName(patient)).toBe('John Doe')
  })

  it('should handle null patient', () => {
    expect(getPatientName(null)).toBe('Unknown Patient')
  })
})

describe('Billing Utils - gstConfig', () => {
  it('should have correct default values', () => {
    expect(gstConfig.cgstRate).toBe(9)
    expect(gstConfig.sgstRate).toBe(9)
    expect(gstConfig.igstRate).toBe(18)
    expect(gstConfig.defaultTaxable).toBe(true)
  })
})
