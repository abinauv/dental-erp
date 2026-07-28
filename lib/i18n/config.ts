/**
 * Supported locales and their regional defaults.
 *
 * A clinic's locale lives on the Hospital record rather than in the URL: this
 * is a logged-in B2B app, so there is no need for `/[locale]/` segments and no
 * need to restructure every route under app/(dashboard).
 *
 * See docs/LOCALIZATION.md for the wider plan.
 */

export const locales = ['en-IN', 'en-US'] as const

export type Locale = (typeof locales)[number]

/** India remains the default — this app started as an Indian dental ERP. */
export const defaultLocale: Locale = 'en-IN'

export interface LocaleDefaults {
  /** ISO 4217 currency code. */
  currency: string
  /** ISO 3166-1 alpha-2. Selects the tax provider once that lands. */
  country: string
  /** IANA timezone. */
  timezone: string
}

export const localeDefaults: Record<Locale, LocaleDefaults> = {
  'en-IN': { currency: 'INR', country: 'IN', timezone: 'Asia/Kolkata' },
  'en-US': { currency: 'USD', country: 'US', timezone: 'America/New_York' },
}

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value)
}

/**
 * Narrow an arbitrary string to a supported locale, falling back to the
 * default. Use at every boundary where a locale arrives from the database or
 * a request, so a stale or hand-edited value can never break formatting.
 */
export function resolveLocale(value: string | null | undefined): Locale {
  return isSupportedLocale(value) ? value : defaultLocale
}

export function getLocaleDefaults(value: string | null | undefined): LocaleDefaults {
  return localeDefaults[resolveLocale(value)]
}
