import { describe, it, expect } from 'vitest'
import enIN from '@/messages/en-IN.json'
import deDE from '@/messages/de-DE.json'
import { getLocaleDefaults, resolveLocale, isSupportedLocale } from '@/lib/i18n/config'
import { createFormatters } from '@/lib/i18n/format'
import { getTaxProvider } from '@/lib/tax'
import { calculateInvoiceTotals, numberToWords } from '@/lib/billing-utils'
import { getSeedData } from '../../prisma/seed-data'
import { getRegions } from '@/lib/geo/regions'

describe('de-DE locale wiring (8.1)', () => {
  it('is a supported locale with EUR / DE / Europe/Berlin defaults', () => {
    expect(isSupportedLocale('de-DE')).toBe(true)
    expect(resolveLocale('de-DE')).toBe('de-DE')
    expect(getLocaleDefaults('de-DE')).toEqual({
      currency: 'EUR',
      country: 'DE',
      timezone: 'Europe/Berlin',
    })
  })
})

describe('de-DE.json completeness (8.2)', () => {
  // Collect every key path (recursing objects; arrays treated as leaves) so a
  // missing/extra key in the German catalogue — which next-intl would render as
  // a raw key path — fails loudly.
  const paths = (obj: unknown, prefix = ''): string[] => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [prefix]
    return Object.keys(obj).flatMap((k) =>
      paths((obj as Record<string, unknown>)[k], prefix ? `${prefix}.${k}` : k)
    )
  }

  it('has exactly the same key set as en-IN', () => {
    const en = paths(enIN).sort()
    const de = paths(deDE).sort()
    expect(de).toEqual(en)
  })

  it('preserves ICU placeholders on every string', () => {
    const ph = (s: unknown) =>
      typeof s === 'string' ? (s.match(/\{[a-zA-Z0-9_]+\}/g) || []).sort().join(',') : ''
    const mismatches: string[] = []
    const walk = (a: any, b: any, p = '') => {
      for (const k of Object.keys(a)) {
        const here = p ? `${p}.${k}` : k
        if (typeof a[k] === 'string') {
          if (ph(a[k]) !== ph(b[k])) mismatches.push(here)
        } else if (a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) {
          walk(a[k], b[k], here)
        }
      }
    }
    walk(enIN, deDE)
    expect(mismatches).toEqual([])
  })

  it('actually translates the core chrome to German', () => {
    expect((deDE as any).nav.Patients).toBe('Patienten')
    expect((deDE as any).billing.invoice.total).toBe('Gesamt')
    expect((deDE as any).billing.invoice.vat).toBe('MwSt.')
    expect((deDE as any).appointments.status.SCHEDULED).toBe('Geplant')
  })
})

describe('de-DE tax + formatting (8.3)', () => {
  it('a DE clinic invoice produces a single VAT component', () => {
    expect(getTaxProvider('DE').country).toBe('EU')
    const totals = calculateInvoiceTotals(
      [{ quantity: 1, unitPrice: 1000, taxable: true }],
      'FIXED',
      0,
      9,
      9,
      { country: 'DE' }
    )
    expect(totals.taxComponents).toHaveLength(1)
    expect(totals.taxComponents[0].code).toBe('VAT')
    expect(totals.taxComponents[0].rate).toBe(19)
    expect(totals.taxAmount).toBe(190)
    expect(totals.totalAmount).toBe(1190)
    // No Indian split leaks in.
    expect(totals.cgstAmount).toBe(0)
    expect(totals.sgstAmount).toBe(0)
  })

  it('formats currency with German grouping (comma decimals, €)', () => {
    const { formatCurrency } = createFormatters('de-DE', 'EUR')
    const formatted = formatCurrency(1234.5, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    expect(formatted).toContain('€')
    expect(formatted).toContain('1.234,50') // de-DE: dot thousands, comma decimal
  })

  it('amount-in-words uses short scale and Euros', () => {
    expect(numberToWords(1190, { currency: 'EUR' })).toBe(
      'One Thousand One Hundred Ninety Euros Only'
    )
  })
})

describe('de-DE per-country data (8.4)', () => {
  it('seeds the German catalogue and Bundesländer', () => {
    const de = getSeedData('DE')
    expect(de.medications.some((m) => m.genericName === 'Pantoprazol')).toBe(true)
    expect(de.procedures.some((p) => p.name === 'Professionelle Zahnreinigung')).toBe(true)
    const regions = getRegions('DE')
    expect(regions).toContain('Bayern')
    expect(regions.length).toBe(16)
  })
})
