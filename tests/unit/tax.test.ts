import { describe, it, expect } from 'vitest'
import { getTaxProvider, indiaGstProvider, euVatProvider, usSalesTaxProvider } from '@/lib/tax'
import { calculateInvoiceTotals } from '@/lib/billing-utils'

describe('tax registry', () => {
  it('resolves IN to India GST', () => {
    expect(getTaxProvider('IN').country).toBe('IN')
  })
  it('resolves EU member states to VAT', () => {
    expect(getTaxProvider('DE')).toBe(euVatProvider)
    expect(getTaxProvider('fr')).toBe(euVatProvider) // case-insensitive
  })
  it('resolves US to sales tax', () => {
    expect(getTaxProvider('US')).toBe(usSalesTaxProvider)
  })
  it('falls back to India GST for unknown/empty country', () => {
    expect(getTaxProvider(undefined)).toBe(indiaGstProvider)
    expect(getTaxProvider('ZZ')).toBe(indiaGstProvider)
  })
})

describe('India GST provider', () => {
  it('splits CGST+SGST intra-state (default/ no context)', () => {
    const r = indiaGstProvider.calculate(1000)
    expect(r.components.map((c) => c.code)).toEqual(['CGST', 'SGST'])
    expect(r.components[0].amount).toBe(90)
    expect(r.components[1].amount).toBe(90)
    expect(r.totalTax).toBe(180)
    expect(r.grandTotal).toBe(1180)
  })

  it('treats same place-of-supply and clinic region as intra-state', () => {
    const r = indiaGstProvider.calculate(1000, {
      placeOfSupply: 'Tamil Nadu',
      clinicRegion: 'tamil nadu ', // case/space-insensitive
    })
    expect(r.components.map((c) => c.code)).toEqual(['CGST', 'SGST'])
  })

  it('applies a single IGST component inter-state', () => {
    const r = indiaGstProvider.calculate(1000, {
      placeOfSupply: 'Kerala',
      clinicRegion: 'Tamil Nadu',
    })
    expect(r.components).toHaveLength(1)
    expect(r.components[0].code).toBe('IGST')
    expect(r.components[0].rate).toBe(18)
    expect(r.components[0].amount).toBe(180)
    expect(r.totalTax).toBe(180)
  })

  it('honours custom rates', () => {
    const r = indiaGstProvider.calculate(1000, { rates: { cgstRate: 6, sgstRate: 6 } })
    expect(r.components[0].amount).toBe(60)
    expect(r.components[1].amount).toBe(60)
    expect(r.totalTax).toBe(120)
  })

  it('rounds each component to 2 dp', () => {
    const r = indiaGstProvider.calculate(99.99)
    expect(r.components[0].amount).toBe(9)
  })
})

describe('EU VAT provider', () => {
  it('produces a single VAT component at the default rate', () => {
    const r = euVatProvider.calculate(1000)
    expect(r.components).toHaveLength(1)
    expect(r.components[0].code).toBe('VAT')
    expect(r.components[0].rate).toBe(19)
    expect(r.components[0].amount).toBe(190)
    expect(r.grandTotal).toBe(1190)
  })
  it('honours a per-clinic VAT rate', () => {
    const r = euVatProvider.calculate(1000, { rates: { vatRate: 7 } })
    expect(r.components[0].amount).toBe(70)
  })
})

describe('US sales tax provider', () => {
  it('is zero with no configured rate', () => {
    const r = usSalesTaxProvider.calculate(1000)
    expect(r.components[0].code).toBe('SALES_TAX')
    expect(r.totalTax).toBe(0)
  })
  it('applies the configured state rate', () => {
    const r = usSalesTaxProvider.calculate(1000, { rates: { salesTaxRate: 8.25 } })
    expect(r.components[0].amount).toBe(82.5)
  })
})

describe('calculateInvoiceTotals tax integration', () => {
  const items = [{ quantity: 1, unitPrice: 1000, taxable: true }]

  it('default path stays CGST+SGST and byte-identical', () => {
    const r = calculateInvoiceTotals(items)
    expect(r.cgstAmount).toBe(90)
    expect(r.sgstAmount).toBe(90)
    expect(r.totalTax).toBe(180)
    expect(r.totalAmount).toBe(1180)
    expect(r.taxAmount).toBe(180)
    expect(r.taxComponents.map((c) => c.code)).toEqual(['CGST', 'SGST'])
  })

  it('inter-state India invoice yields IGST with zero legacy CGST/SGST', () => {
    const r = calculateInvoiceTotals(items, 'FIXED', 0, 9, 9, {
      country: 'IN',
      placeOfSupply: 'Kerala',
      clinicRegion: 'Tamil Nadu',
    })
    expect(r.taxComponents).toHaveLength(1)
    expect(r.taxComponents[0].code).toBe('IGST')
    expect(r.taxAmount).toBe(180)
    expect(r.totalAmount).toBe(1180)
    // legacy columns are zero for an inter-state breakdown
    expect(r.cgstAmount).toBe(0)
    expect(r.sgstAmount).toBe(0)
  })

  it('VAT country yields a single VAT component', () => {
    const r = calculateInvoiceTotals(items, 'FIXED', 0, 9, 9, { country: 'DE' })
    expect(r.taxComponents).toHaveLength(1)
    expect(r.taxComponents[0].code).toBe('VAT')
    expect(r.taxAmount).toBe(190)
    expect(r.totalAmount).toBe(1190)
    expect(r.cgstAmount).toBe(0)
  })
})
