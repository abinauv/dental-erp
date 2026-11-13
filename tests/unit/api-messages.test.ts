// API error messages in the requester's language (lib/i18n/api-messages).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const h = vi.hoisted(() => ({ locale: vi.fn() }))
vi.mock('@/lib/i18n/request', () => ({ getLocaleForApiRequest: h.locale }))

import { catalogueFor, translateError, translateMessage } from '@/lib/i18n/api-messages'

beforeEach(() => {
  h.locale.mockReset()
})

describe('translateMessage', () => {
  it('translates into German and leaves English as written', () => {
    expect(translateMessage('Patient not found', 'de-DE')).toBe('Patient nicht gefunden')
    expect(translateMessage('Patient not found', 'en-IN')).toBe('Patient not found')
    expect(translateMessage('Patient not found', 'en-US')).toBe('Patient not found')
  })

  it('fills in values, in either language', () => {
    const msg = 'Payment amount ({amount}) exceeds balance ({balance})'
    expect(translateMessage(msg, 'en-IN', { amount: 500, balance: 200 })).toBe(
      'Payment amount (500) exceeds balance (200)'
    )
    expect(translateMessage(msg, 'de-DE', { amount: 500, balance: 200 })).toBe(
      'Der Zahlungsbetrag (500) übersteigt den offenen Betrag (200)'
    )
  })

  it('sends a message nobody has translated in English', () => {
    expect(translateMessage('Something brand new went wrong', 'de-DE')).toBe(
      'Something brand new went wrong'
    )
  })
})

describe('translateError', () => {
  it('uses the requester’s language', async () => {
    h.locale.mockResolvedValue('de-DE')
    expect(await translateError('Unauthorized')).toBe('Nicht angemeldet')
    h.locale.mockResolvedValue('en-US')
    expect(await translateError('Unauthorized')).toBe('Unauthorized')
  })

  it('translates a known message passed through from a service', async () => {
    h.locale.mockResolvedValue('de-DE')
    const err = new Error('SMS can only be scheduled between 9 AM and 9 PM IST')
    expect(await translateError(err.message || 'Failed to send SMS')).toBe(
      'SMS können nur zwischen 9 und 21 Uhr IST geplant werden'
    )
  })

  it('falls back to English if the language can’t be worked out', async () => {
    h.locale.mockRejectedValue(new Error('no request scope'))
    expect(await translateError('Patient not found')).toBe('Patient not found')
    expect(await translateError('Insufficient points. Balance: {balance}', { balance: 3 })).toBe(
      'Insufficient points. Balance: 3'
    )
  })

  it('passes an empty message through', async () => {
    expect(await translateError(undefined)).toBe('')
    expect(h.locale).not.toHaveBeenCalled()
  })
})

// ── The German catalogue matches the code ──────────────────────────────────

const repo = join(__dirname, '..', '..')
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === 'generated' || name === 'node_modules') return []
    if (statSync(path).isDirectory()) return sources(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}
const files = [...sources(join(repo, 'app')), ...sources(join(repo, 'lib'))].filter(
  (f) => !f.endsWith(join('i18n', 'api-messages.ts'))
)
const code = files.map((f) => ({ file: relative(repo, f), text: readFileSync(f, 'utf8') }))
const catalogue = catalogueFor('de-DE')!
const unescape = (s: string) => s.replace(/\\(['"])/g, '$1')

describe('messages/api/de-DE.json', () => {
  it('has a German entry for every literal message passed to translateError', () => {
    const missing: string[] = []
    const literal = /translateError\(\s*(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)")/g
    for (const { file, text } of code) {
      for (const m of text.matchAll(literal)) {
        const message = unescape(m[1] ?? m[2])
        if (!(message in catalogue)) missing.push(`${file}: ${message}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('keeps the same {placeholders} in every translation', () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    const mismatched = Object.entries(catalogue).filter(([en, de]) => {
      return JSON.stringify(names(en)) !== JSON.stringify(names(de))
    })
    expect(mismatched).toEqual([])
  })

  it('has no entries the code no longer sends', () => {
    const all = code.map((c) => unescape(c.text)).join('\n')
    const unused = Object.keys(catalogue).filter(
      (en) => !all.includes(`'${en}'`) && !all.includes(`"${en}"`)
    )
    expect(unused).toEqual([])
  })
})
