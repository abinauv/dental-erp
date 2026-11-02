import type { TaxComponent, TaxContext, TaxProvider, TaxResult } from '../types'
import { round2 } from '../types'

/** Default Indian GST rates (18% total, split 9/9 intra-state). */
export const INDIA_GST_DEFAULTS = {
  cgstRate: 9,
  sgstRate: 9,
  igstRate: 18,
}

/** Normalize a region string for comparison (case/space-insensitive). */
function sameRegion(a?: string, b?: string): boolean {
  if (!a || !b) return false
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/**
 * Indian GST. Reproduces the historical CGST+SGST split exactly for an
 * intra-state supply, and applies a single IGST component for an inter-state
 * supply (place of supply differs from the clinic's region) — the split that
 * `gstConfig` always anticipated but `calculateGST()` never implemented.
 *
 * When the place of supply or the clinic region is unknown, it assumes
 * intra-state (CGST+SGST), matching prior behaviour.
 */
export const indiaGstProvider: TaxProvider = {
  country: 'IN',

  calculate(taxableAmount: number, context: TaxContext = {}): TaxResult {
    const cgstRate = context.rates?.cgstRate ?? INDIA_GST_DEFAULTS.cgstRate
    const sgstRate = context.rates?.sgstRate ?? INDIA_GST_DEFAULTS.sgstRate
    const igstRate = context.rates?.igstRate ?? cgstRate + sgstRate

    const interState =
      !!context.placeOfSupply &&
      !!context.clinicRegion &&
      !sameRegion(context.placeOfSupply, context.clinicRegion)

    const components: TaxComponent[] = interState
      ? [
          {
            code: 'IGST',
            label: 'IGST',
            rate: igstRate,
            amount: round2((taxableAmount * igstRate) / 100),
          },
        ]
      : [
          {
            code: 'CGST',
            label: 'CGST',
            rate: cgstRate,
            amount: round2((taxableAmount * cgstRate) / 100),
          },
          {
            code: 'SGST',
            label: 'SGST',
            rate: sgstRate,
            amount: round2((taxableAmount * sgstRate) / 100),
          },
        ]

    const totalTax = round2(components.reduce((sum, c) => sum + c.amount, 0))

    return {
      taxableAmount: round2(taxableAmount),
      components,
      totalTax,
      grandTotal: round2(taxableAmount + totalTax),
    }
  },
}
