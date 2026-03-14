// @ts-nocheck
import { describe, it, expect, vi } from 'vitest'

vi.mock('@prisma/client', () => ({
  InvoiceStatus: { DRAFT: 'DRAFT', PENDING: 'PENDING', PARTIALLY_PAID: 'PARTIALLY_PAID', PAID: 'PAID', OVERDUE: 'OVERDUE', CANCELLED: 'CANCELLED', REFUNDED: 'REFUNDED' },
  PaymentMethod: { CASH: 'CASH', CARD: 'CARD', UPI: 'UPI', BANK_TRANSFER: 'BANK_TRANSFER', CHEQUE: 'CHEQUE', INSURANCE: 'INSURANCE', WALLET: 'WALLET', ONLINE: 'ONLINE' },
  PaymentStatus: { PENDING: 'PENDING', COMPLETED: 'COMPLETED', FAILED: 'FAILED', REFUNDED: 'REFUNDED', CANCELLED: 'CANCELLED' },
  InsuranceClaimStatus: { DRAFT: 'DRAFT', SUBMITTED: 'SUBMITTED', UNDER_REVIEW: 'UNDER_REVIEW', APPROVED: 'APPROVED', PARTIALLY_APPROVED: 'PARTIALLY_APPROVED', REJECTED: 'REJECTED', SETTLED: 'SETTLED' },
  DiscountType: { PERCENTAGE: 'PERCENTAGE', FIXED: 'FIXED' },
}))

import { formatCurrency, formatDate, formatPhone, validateAadhar, validateIndianPhone, validateGSTIN } from '@/lib/utils'
import {
  gstConfig, calculateGST, discountTypeConfig,
  formatCurrency as billingFormatCurrency,
  numberToWords, formatDateTime as billingFormatDateTime
} from '@/lib/billing-utils'

describe('Section 10.1 — Current Locale (India)', () => {

  // ─── Currency Display ───────────────────────────────────────────────

  describe('Currency Display', () => {
    it('formatCurrency from utils displays ₹ symbol', () => {
      const result = formatCurrency(500)
      expect(result).toContain('₹')
    })

    it('billingFormatCurrency displays ₹ with 2 decimal places', () => {
      const result = billingFormatCurrency(500)
      expect(result).toContain('₹')
      expect(result).toMatch(/500\.00/)
    })

    it('uses Indian number formatting — lakhs (1,00,000 not 100,000)', () => {
      const result = formatCurrency(100000)
      // en-IN formats 100000 as 1,00,000
      expect(result).toContain('1,00,000')
    })

    it('uses Indian number formatting — crores', () => {
      const result = formatCurrency(10000000)
      // en-IN formats 10000000 as 1,00,00,000
      expect(result).toContain('1,00,00,000')
    })

    it('zero amount renders as ₹0', () => {
      const result = formatCurrency(0)
      expect(result).toContain('₹')
      expect(result).toMatch(/0/)
    })

    it('large amounts use crore formatting in billing', () => {
      const result = billingFormatCurrency(25000000)
      // 2,50,00,000.00
      expect(result).toContain('2,50,00,000')
    })

    it('negative amounts are handled', () => {
      const result = formatCurrency(-1500)
      expect(result).toContain('₹')
      expect(result).toContain('1,500')
    })

    it('discountTypeConfig.FIXED.symbol is ₹', () => {
      expect(discountTypeConfig.FIXED.symbol).toBe('₹')
    })
  })

  // ─── Date Format ────────────────────────────────────────────────────

  describe('Date Format', () => {
    it('formatDate uses en-IN locale', () => {
      const result = formatDate(new Date(2026, 2, 8)) // March 8, 2026
      // en-IN with day:2-digit, month:short, year:numeric => "08 Mar 2026"
      expect(result).toMatch(/08/)
      expect(result).toMatch(/Mar/)
      expect(result).toMatch(/2026/)
    })

    it('output format is DD Mon YYYY', () => {
      const result = formatDate(new Date(2026, 0, 15)) // Jan 15, 2026
      expect(result).toMatch(/15.*Jan.*2026/)
    })

    it('invalid date returns "-"', () => {
      expect(formatDate('not-a-date')).toBe('-')
    })

    it('string date input works', () => {
      const result = formatDate('2026-03-08')
      expect(result).toMatch(/Mar/)
      expect(result).toMatch(/2026/)
    })

    it('Date object input works', () => {
      const result = formatDate(new Date(2025, 11, 25)) // Dec 25, 2025
      expect(result).toMatch(/25/)
      expect(result).toMatch(/Dec/)
      expect(result).toMatch(/2025/)
    })
  })

  // ─── Phone Number Format ────────────────────────────────────────────

  describe('Phone Number Format', () => {
    it('formatPhone adds +91 prefix for 10-digit number', () => {
      const result = formatPhone('9876543210')
      expect(result).toBe('+91 98765 43210')
    })

    it('formatPhone handles 12-digit number with 91 prefix', () => {
      const result = formatPhone('919876543210')
      expect(result).toBe('+91 98765 43210')
    })

    it('validateIndianPhone accepts valid numbers starting with 6', () => {
      expect(validateIndianPhone('6123456789')).toBe(true)
    })

    it('validateIndianPhone accepts valid numbers starting with 7', () => {
      expect(validateIndianPhone('7123456789')).toBe(true)
    })

    it('validateIndianPhone accepts valid numbers starting with 8', () => {
      expect(validateIndianPhone('8123456789')).toBe(true)
    })

    it('validateIndianPhone accepts valid numbers starting with 9', () => {
      expect(validateIndianPhone('9123456789')).toBe(true)
    })

    it('validateIndianPhone rejects numbers starting with 0-5', () => {
      expect(validateIndianPhone('0123456789')).toBe(false)
      expect(validateIndianPhone('1234567890')).toBe(false)
      expect(validateIndianPhone('2345678901')).toBe(false)
      expect(validateIndianPhone('3456789012')).toBe(false)
      expect(validateIndianPhone('4567890123')).toBe(false)
      expect(validateIndianPhone('5678901234')).toBe(false)
    })

    it('validateIndianPhone rejects wrong length', () => {
      expect(validateIndianPhone('98765')).toBe(false)
      expect(validateIndianPhone('987654321')).toBe(false) // 9 digits
      expect(validateIndianPhone('98765432101')).toBe(false) // 11 digits
    })
  })

  // ─── GST Format ─────────────────────────────────────────────────────

  describe('GST Format', () => {
    it('gstConfig has CGST 9% and SGST 9%', () => {
      expect(gstConfig.cgstRate).toBe(9)
      expect(gstConfig.sgstRate).toBe(9)
    })

    it('calculateGST(1000) gives 90 CGST + 90 SGST = 180 tax, 1180 total', () => {
      const result = calculateGST(1000)
      expect(result.cgstAmount).toBe(90)
      expect(result.sgstAmount).toBe(90)
      expect(result.totalTax).toBe(180)
      expect(result.grandTotal).toBe(1180)
    })

    it('GST is 18% total (standard Indian goods & services tax)', () => {
      expect(gstConfig.cgstRate + gstConfig.sgstRate).toBe(18)
      expect(gstConfig.igstRate).toBe(18)
    })
  })

  // ─── Aadhaar Validation ─────────────────────────────────────────────

  describe('Aadhaar Validation', () => {
    it('validateAadhar accepts 12-digit numbers', () => {
      expect(validateAadhar('123456789012')).toBe(true)
    })

    it('rejects shorter numbers', () => {
      expect(validateAadhar('12345678901')).toBe(false) // 11 digits
    })

    it('rejects longer numbers', () => {
      expect(validateAadhar('1234567890123')).toBe(false) // 13 digits
    })

    it('handles formatted input with spaces', () => {
      expect(validateAadhar('1234 5678 9012')).toBe(true)
    })

    it('handles formatted input with dashes', () => {
      expect(validateAadhar('1234-5678-9012')).toBe(true)
    })
  })

  // ─── Number to Words (Indian) ───────────────────────────────────────

  describe('Number to Words (Indian)', () => {
    it('numberToWords(1) returns "One Rupees Only"', () => {
      expect(numberToWords(1)).toBe('One Rupees Only')
    })

    it('numberToWords(100000) contains "Lakh" (not "Hundred Thousand")', () => {
      const result = numberToWords(100000)
      expect(result).toContain('Lakh')
      expect(result).not.toContain('Hundred Thousand')
    })

    it('numberToWords(10000000) contains "Crore"', () => {
      const result = numberToWords(10000000)
      expect(result).toContain('Crore')
    })

    it('numberToWords(1500.50) contains "Rupees" and "Paise"', () => {
      const result = numberToWords(1500.50)
      expect(result).toContain('Rupees')
      expect(result).toContain('Paise')
    })

    it('numberToWords(0) returns "Zero"', () => {
      expect(numberToWords(0)).toBe('Zero')
    })
  })

  // ─── GSTIN Validation ──────────────────────────────────────────────

  describe('GSTIN Validation', () => {
    it('accepts valid GSTIN (27AAPFU0939F1ZV)', () => {
      expect(validateGSTIN('27AAPFU0939F1ZV')).toBe(true)
    })

    it('accepts valid GSTIN from different states', () => {
      // State code 07 = Delhi
      expect(validateGSTIN('07AAPFU0939F1ZV')).toBe(true)
      // State code 33 = Tamil Nadu
      expect(validateGSTIN('33AAPFU0939F1ZV')).toBe(true)
    })

    it('rejects GSTIN shorter than 15 characters', () => {
      expect(validateGSTIN('27AAPFU0939F')).toBe(false)
    })

    it('rejects GSTIN longer than 15 characters', () => {
      expect(validateGSTIN('27AAPFU0939F1ZVXX')).toBe(false)
    })

    it('rejects GSTIN with invalid state code (00)', () => {
      expect(validateGSTIN('00AAPFU0939F1ZV')).toBe(false)
    })

    it('rejects GSTIN with state code > 37', () => {
      expect(validateGSTIN('99AAPFU0939F1ZV')).toBe(false)
    })

    it('rejects empty string', () => {
      expect(validateGSTIN('')).toBe(false)
    })

    it('rejects lowercase GSTIN', () => {
      expect(validateGSTIN('27aapfu0939f1zv')).toBe(false)
    })

    it('rejects GSTIN without Z in 13th position', () => {
      expect(validateGSTIN('27AAPFU0939F1AV')).toBe(false)
    })

    it('rejects GSTIN with special characters', () => {
      expect(validateGSTIN('27AAPFU0939F1Z!')).toBe(false)
    })
  })

  // ─── Time Format ────────────────────────────────────────────────────

  describe('Time Format', () => {
    it('billingFormatDateTime uses 12-hour AM/PM format', () => {
      // 14:30 (2:30 PM)
      const date = new Date(2026, 2, 8, 14, 30, 0)
      const result = billingFormatDateTime(date)
      // en-IN with hour12:true should produce am/pm or AM/PM
      expect(result).toMatch(/[apAP][mM]/)
    })

    it('billingFormatDateTime includes date components', () => {
      const date = new Date(2026, 2, 8, 10, 15, 0)
      const result = billingFormatDateTime(date)
      expect(result).toMatch(/08/)
      expect(result).toMatch(/Mar/)
      expect(result).toMatch(/2026/)
    })
  })
})
