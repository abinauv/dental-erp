import { describe, it, expect } from 'vitest'

import {
  defaultLocale,
  getLocaleLabel,
  resolveLocaleCascade,
  resolvePublicLocale,
} from '@/lib/i18n/config'

describe('resolveLocaleCascade', () => {
  it('takes the most specific supported candidate', () => {
    expect(resolveLocaleCascade('en-US', 'en-IN')).toBe('en-US')
  })

  // The reason both columns are nullable. Null is not a preference, it is the
  // absence of one, and it has to keep falling through to the clinic.
  it('treats null and undefined as "inherit", not as a choice', () => {
    expect(resolveLocaleCascade(null, 'en-US')).toBe('en-US')
    expect(resolveLocaleCascade(undefined, 'en-US')).toBe('en-US')
  })

  it('treats an empty string as "inherit"', () => {
    expect(resolveLocaleCascade('', 'en-US')).toBe('en-US')
  })

  // A clinic changing its locale must move everyone who never overrode it.
  it('propagates a clinic change to users who have not overridden', () => {
    const users = [{ locale: null }, { locale: null }, { locale: 'en-US' }]

    const before = users.map((u) => resolveLocaleCascade(u.locale, 'en-IN'))
    const after = users.map((u) => resolveLocaleCascade(u.locale, 'en-US'))

    expect(before).toEqual(['en-IN', 'en-IN', 'en-US'])
    expect(after).toEqual(['en-US', 'en-US', 'en-US'])
  })

  // The behaviour that `resolveLocale(user ?? hospital)` would get wrong: it
  // would see a non-null user value, fail to support it, and return the
  // default — skipping a clinic locale that is perfectly valid.
  it('falls through an unsupported stored value to the next candidate', () => {
    expect(resolveLocaleCascade('de-DE', 'en-US')).toBe('en-US')
    expect(resolveLocaleCascade('not-a-locale', 'en-US')).toBe('en-US')
  })

  it('falls back to the default when nothing is supported', () => {
    expect(resolveLocaleCascade('de-DE', 'fr-FR')).toBe(defaultLocale)
    expect(resolveLocaleCascade(null, null)).toBe(defaultLocale)
    expect(resolveLocaleCascade()).toBe(defaultLocale)
  })

  it('is case sensitive, matching the stored BCP 47 tags exactly', () => {
    // Guards against a "helpful" normalisation being added later without a
    // migration of the values already in the column.
    expect(resolveLocaleCascade('EN-us', 'en-IN')).toBe('en-IN')
  })
})

describe('resolvePublicLocale', () => {
  it('honours ?lang= over the clinic locale', () => {
    expect(resolvePublicLocale('en-IN', 'en-US')).toBe('en-US')
  })

  it('falls back to the clinic when ?lang= is absent or unsupported', () => {
    expect(resolvePublicLocale('en-US')).toBe('en-US')
    expect(resolvePublicLocale('en-US', undefined)).toBe('en-US')
    expect(resolvePublicLocale('en-US', 'de-DE')).toBe('en-US')
  })

  // Next surfaces `?lang=a&lang=b` as an array.
  it('takes the first value of a repeated query parameter', () => {
    expect(resolvePublicLocale('en-IN', ['en-US', 'de-DE'])).toBe('en-US')
    expect(resolvePublicLocale('en-IN', [])).toBe('en-IN')
  })

  it('falls back to the default when the clinic locale is missing too', () => {
    expect(resolvePublicLocale(null, null)).toBe(defaultLocale)
  })
})

describe('getLocaleLabel', () => {
  // Asserted loosely on purpose: the exact wording comes from whatever ICU
  // data the runtime ships, and pinning it makes the suite fail on a Node
  // upgrade for no useful reason.
  it('names each supported locale by region rather than by tag', () => {
    expect(getLocaleLabel('en-IN')).toMatch(/English.*India/)
    expect(getLocaleLabel('en-US')).toMatch(/English.*United States/)
  })

  it('returns the tag itself rather than throwing on nonsense input', () => {
    expect(getLocaleLabel('not a tag')).toBe('not a tag')
  })
})
