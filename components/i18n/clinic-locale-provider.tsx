'use client'

import { createContext, useContext, useMemo } from 'react'
import { useLocale } from 'next-intl'

import { createFormatters } from '@/lib/i18n/format'
import { defaultLocale, getLocaleDefaults } from '@/lib/i18n/config'

interface ClinicLocaleValue {
  /** The clinic's billing currency (ISO 4217, from Hospital.currency). */
  currency: string
}

// Default to the global default currency so a component rendered outside the
// provider — in a test, or a surface not yet wired — formats sensibly instead
// of throwing.
const ClinicLocaleContext = createContext<ClinicLocaleValue>({
  currency: getLocaleDefaults(defaultLocale).currency,
})

export function ClinicLocaleProvider({
  currency,
  children,
}: {
  currency: string
  children: React.ReactNode
}) {
  const value = useMemo(() => ({ currency }), [currency])
  return <ClinicLocaleContext.Provider value={value}>{children}</ClinicLocaleContext.Provider>
}

export function useClinicLocale(): ClinicLocaleValue {
  return useContext(ClinicLocaleContext)
}

/**
 * Formatters bound to the viewer's resolved locale (from next-intl) and the
 * clinic's billing currency. Use these in client components in place of the
 * fixed en-IN/INR helpers: the locale follows the person's preference while the
 * currency stays the clinic's.
 */
export function useClinicFormatters() {
  const locale = useLocale()
  const { currency } = useClinicLocale()
  return useMemo(() => createFormatters(locale, currency), [locale, currency])
}
