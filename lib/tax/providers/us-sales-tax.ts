import type { TaxContext, TaxProvider, TaxResult } from '../types'
import { round2 } from '../types'

/**
 * US sales tax stub. There is no federal sales tax; the effective rate is the
 * state (plus local) rate, which varies and must be supplied per clinic via
 * context.rates.salesTaxRate. With no rate configured this yields a zero-tax,
 * single-component result — enough to prove a non-GST country renders a valid
 * invoice. Jurisdiction lookup is a later refinement.
 */
export const usSalesTaxProvider: TaxProvider = {
  country: 'US',

  calculate(taxableAmount: number, context: TaxContext = {}): TaxResult {
    const rate = context.rates?.salesTaxRate ?? 0
    const amount = round2((taxableAmount * rate) / 100)

    return {
      taxableAmount: round2(taxableAmount),
      components: [{ code: 'SALES_TAX', label: 'Sales Tax', rate, amount }],
      totalTax: amount,
      grandTotal: round2(taxableAmount + amount),
    }
  },
}
