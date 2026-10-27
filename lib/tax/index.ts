import type { TaxProvider } from './types'
import { indiaGstProvider } from './providers/india-gst'
import { euVatProvider } from './providers/eu-vat'
import { usSalesTaxProvider } from './providers/us-sales-tax'

export type { TaxComponent, TaxResult, TaxContext, TaxRates, TaxProvider } from './types'
export { round2 } from './types'
export { indiaGstProvider, INDIA_GST_DEFAULTS } from './providers/india-gst'
export { euVatProvider, EU_VAT_DEFAULT_RATE } from './providers/eu-vat'
export { usSalesTaxProvider } from './providers/us-sales-tax'

// EU member states that bill VAT. de-DE is Batch 8's proof locale; the rest are
// here so a clinic in any of them resolves to the VAT provider rather than the
// India default.
const EU_VAT_COUNTRIES = [
  'DE',
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
]

const REGISTRY: Record<string, TaxProvider> = {
  IN: indiaGstProvider,
  US: usSalesTaxProvider,
  ...Object.fromEntries(EU_VAT_COUNTRIES.map((c) => [c, euVatProvider])),
}

/**
 * Resolve the tax provider for an ISO 3166-1 alpha-2 country code. Unknown
 * countries fall back to India GST, preserving behaviour for existing clinics
 * (all of which default to country "IN").
 */
export function getTaxProvider(country: string | null | undefined): TaxProvider {
  const code = (country || 'IN').toUpperCase()
  return REGISTRY[code] ?? indiaGstProvider
}
