// Translating the messages API routes send back (`{ error: '…' }`).
//
// The English text is the message's identity: routes keep writing English,
//   return NextResponse.json({ error: await translateError('Patient not found') }, …)
// and the catalogue for each other language maps that text to a translation
// (messages/api/<locale>.json). A message with no entry is sent in English,
// as the UI does for its untranslated long tail. Values go in {braces}:
//   await translateError('Staff limit reached ({max}).', { max })
//
// These catalogues are separate from messages/<locale>.json on purpose: those
// are sent to the browser with every page, and API messages never need to be.
//
// The language is the requester's (lib/i18n/request.ts): a staff member's or
// patient's own setting, else their clinic's, else the default.

import deDE from '@/messages/api/de-DE.json'
import type { Locale } from './config'

type Catalogue = Record<string, string>

// English needs no catalogue: the source text is English.
const catalogues: Partial<Record<Locale, Catalogue>> = {
  'de-DE': deDE as Catalogue,
}

type Values = Record<string, string | number | null | undefined>

function fill(template: string, values?: Values): string {
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    values[name] === undefined || values[name] === null ? match : String(values[name])
  )
}

/** `message` in `locale`, with its {placeholders} filled in. */
export function translateMessage(message: string, locale: Locale, values?: Values): string {
  return fill(catalogues[locale]?.[message] ?? message, values)
}

/**
 * `message` in the language of whoever made the current request. Never
 * throws: anything that goes wrong (no request scope, no database) gives the
 * English text.
 */
export async function translateError(
  message: string | null | undefined,
  values?: Values
): Promise<string> {
  // A passed-through error can lack a message.
  if (!message) return ''
  try {
    const { getLocaleForApiRequest } = await import('./request')
    return translateMessage(message, await getLocaleForApiRequest(), values)
  } catch {
    return fill(message, values)
  }
}

/** For tests: the catalogue for a locale. */
export function catalogueFor(locale: Locale): Catalogue | undefined {
  return catalogues[locale]
}
