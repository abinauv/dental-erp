/**
 * Locale-agnostic tax model.
 *
 * The move here is to stop treating "CGST + SGST" as *the* shape of tax and
 * treat it as one possible breakdown among many (IGST, VAT, US sales tax, …).
 * A country-specific `TaxProvider` turns a taxable base into a list of
 * `TaxComponent`s; the invoice persists that list (`Invoice.taxComponents`)
 * plus the scalar total (`Invoice.taxAmount`), so a historical invoice always
 * re-renders with the breakdown that was in force when it was issued.
 *
 * See docs/LOCALIZATION.md §2 ("The tax abstraction").
 */

export interface TaxComponent {
  /** Stable machine code, e.g. 'CGST' | 'SGST' | 'IGST' | 'VAT' | 'SALES_TAX'. */
  code: string
  /** Display label. Tax acronyms are not translated, so this doubles as the code. */
  label: string
  /** Percentage rate applied to the taxable base. */
  rate: number
  /** Monetary amount for this component, rounded to 2 dp. */
  amount: number
}

export interface TaxResult {
  /** The base the tax was computed on (taxable total after discount). */
  taxableAmount: number
  components: TaxComponent[]
  /** Sum of component amounts, rounded to 2 dp. */
  totalTax: number
  /** taxableAmount + totalTax (excludes any non-taxable total the caller tracks). */
  grandTotal: number
}

export interface TaxRates {
  cgstRate?: number
  sgstRate?: number
  igstRate?: number
  vatRate?: number
  salesTaxRate?: number
}

export interface TaxContext {
  /** Where the supply is consumed (patient's region). Drives intra/inter-state. */
  placeOfSupply?: string
  /** The clinic's own region. */
  clinicRegion?: string
  /** Per-clinic rate overrides; each provider reads the ones it cares about. */
  rates?: TaxRates
}

export interface TaxProvider {
  /** ISO 3166-1 alpha-2 country this provider serves. */
  readonly country: string
  calculate(taxableAmount: number, context?: TaxContext): TaxResult
}

/** Round to 2 decimal places, matching the legacy invoice maths. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}
