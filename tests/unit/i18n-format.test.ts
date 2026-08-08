import { describe, it, expect } from 'vitest'

import {
  defaultLocale,
  getLocaleDefaults,
  isSupportedLocale,
  locales,
  resolveLocale,
} from '@/lib/i18n/config'
import {
  createFormatters,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
} from '@/lib/i18n/format'

describe('i18n config', () => {
  it('defaults to Indian English', () => {
    expect(defaultLocale).toBe('en-IN')
    expect(locales).toContain('en-IN')
  })

  it('recognises supported locales', () => {
    expect(isSupportedLocale('en-IN')).toBe(true)
    expect(isSupportedLocale('en-US')).toBe(true)
    expect(isSupportedLocale('xx-XX')).toBe(false)
    expect(isSupportedLocale(null)).toBe(false)
  })

  // A stale or hand-edited Hospital.locale must never break formatting.
  it('falls back to the default for unknown or missing locales', () => {
    expect(resolveLocale('de-DE')).toBe('en-IN')
    expect(resolveLocale(undefined)).toBe('en-IN')
    expect(resolveLocale('en-US')).toBe('en-US')
  })

  it('maps each locale to its currency, country and timezone', () => {
    expect(getLocaleDefaults('en-IN')).toEqual({
      currency: 'INR',
      country: 'IN',
      timezone: 'Asia/Kolkata',
    })
    expect(getLocaleDefaults('en-US').currency).toBe('USD')
  })
})

describe('formatCurrency', () => {
  it('defaults to rupees so existing call sites are unchanged', () => {
    expect(formatCurrency(1000)).toContain('₹')
    expect(formatCurrency(1000)).toContain('1,000')
  })

  it('uses the Indian grouping system for en-IN', () => {
    // The grouping differs, not just the symbol: 1,00,000 rather than 100,000.
    expect(formatCurrency(100000)).toContain('1,00,000')
    expect(formatCurrency(10000000)).toContain('1,00,00,000')
  })

  it('uses western grouping and dollars for en-US', () => {
    const result = formatCurrency(100000, { locale: 'en-US' })
    expect(result).toContain('$')
    expect(result).toContain('100,000')
    expect(result).not.toContain('1,00,000')
  })

  it('accepts numeric strings', () => {
    expect(formatCurrency('1234.56')).toContain('1,234.56')
  })

  it('returns a formatted zero for null, undefined and unparseable input', () => {
    expect(formatCurrency(null)).toContain('0')
    expect(formatCurrency(undefined)).toContain('0')
    expect(formatCurrency('not a number')).toContain('0')
  })

  it('does not leak a rupee sign into a non-INR fallback', () => {
    expect(formatCurrency(null, { locale: 'en-US' })).not.toContain('₹')
  })

  it('honours an explicit fallback', () => {
    expect(formatCurrency(null, { fallback: '—' })).toBe('—')
  })

  it('respects fraction digit overrides', () => {
    expect(formatCurrency(500, { minimumFractionDigits: 2, maximumFractionDigits: 2 })).toContain(
      '500.00'
    )
  })

  it('formats negative amounts', () => {
    expect(formatCurrency(-1500)).toContain('1,500')
  })
})

describe('formatNumber', () => {
  it('groups by locale without a currency symbol', () => {
    expect(formatNumber(100000)).toBe('1,00,000')
    expect(formatNumber(100000, { locale: 'en-US' })).toBe('100,000')
  })

  it('falls back for invalid input', () => {
    expect(formatNumber(null)).toBe('-')
    expect(formatNumber('abc', { fallback: 'n/a' })).toBe('n/a')
  })
})

describe('formatDate / formatDateTime', () => {
  it('formats a date consistently', () => {
    const result = formatDate(new Date('2026-01-15T00:00:00Z'))
    expect(result).toContain('2026')
    expect(result).toContain('Jan')
  })

  it('accepts date strings', () => {
    expect(formatDate('2026-06-20T00:00:00Z')).toContain('2026')
  })

  it('returns the fallback for missing or invalid dates', () => {
    expect(formatDate(null)).toBe('-')
    expect(formatDate('not a date')).toBe('-')
    expect(formatDateTime(undefined)).toBe('-')
    expect(formatDate(null, { fallback: '—' })).toBe('—')
  })

  it('includes a time component in formatDateTime', () => {
    const result = formatDateTime(new Date('2026-01-15T13:30:00Z'))
    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })

  it('orders the date parts per locale', () => {
    const date = new Date('2026-03-04T00:00:00Z')
    expect(formatDate(date, { locale: 'en-US', timeZone: 'UTC' })).toMatch(/Mar 04, 2026/)
    expect(formatDate(date, { locale: 'en-IN', timeZone: 'UTC' })).toMatch(/04 Mar 2026/)
  })
})

describe('createFormatters', () => {
  it('binds every formatter to one locale', () => {
    const us = createFormatters('en-US')
    expect(us.locale).toBe('en-US')
    expect(us.currency).toBe('USD')
    expect(us.formatCurrency(100000)).toContain('$')
    expect(us.formatNumber(100000)).toBe('100,000')
  })

  it('falls back to the default locale for unsupported input', () => {
    expect(createFormatters('fr-FR').locale).toBe('en-IN')
    expect(createFormatters(null).currency).toBe('INR')
  })
})
