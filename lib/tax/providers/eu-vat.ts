import type { TaxContext, TaxProvider, TaxResult } from '../types'
import { round2 } from '../types'

/** Standard VAT rate used when a clinic has not overridden it (Germany: 19%). */
export const EU_VAT_DEFAULT_RATE = 19

/**
 * Single-component VAT, used by EU clinics. Batch 8's de-DE proof exercises
 * this; the rate is per-clinic (context.rates.vatRate) and defaults to the
 * German standard rate. Reduced/zero rates per line are a later refinement.
 */
export const euVatProvider: TaxProvider = {
  country: 'EU',

  calculate(taxableAmount: number, context: TaxContext = {}): TaxResult {
    const rate = context.rates?.vatRate ?? EU_VAT_DEFAULT_RATE
    const amount = round2((taxableAmount * rate) / 100)

    return {
      taxableAmount: round2(taxableAmount),
      components: [{ code: 'VAT', label: 'VAT', rate, amount }],
      totalTax: amount,
      grandTotal: round2(taxableAmount + amount),
    }
  },
}
