// A clinic's password rules and how a password is checked against them.
import { describe, it, expect } from 'vitest'
import {
  DEFAULT_PASSWORD_POLICY,
  describeProblems,
  passwordProblems,
  policyFromSettings,
  policyRules,
  type PasswordPolicy,
} from '@/lib/password-policy'

const lenient: PasswordPolicy = {
  minLength: 8,
  requireUppercase: false,
  requireLowercase: false,
  requireNumbers: false,
  requireSpecialChars: false,
}

describe('passwordProblems', () => {
  it('accepts a password meeting every default rule', () => {
    expect(passwordProblems('Smile2026!', DEFAULT_PASSWORD_POLICY)).toEqual([])
  })

  it('names each rule a password breaks, in order', () => {
    expect(passwordProblems('abc', DEFAULT_PASSWORD_POLICY)).toEqual([
      'minLength',
      'uppercase',
      'number',
      'special',
    ])
    expect(passwordProblems('ABCDEFGH1!', DEFAULT_PASSWORD_POLICY)).toEqual(['lowercase'])
  })

  it('only checks the rules the clinic turned on', () => {
    expect(passwordProblems('longenough', lenient)).toEqual([])
    expect(passwordProblems('short', lenient)).toEqual(['minLength'])
  })

  it('never goes below 6 characters or above 128', () => {
    expect(passwordProblems('Ab1!x', { ...DEFAULT_PASSWORD_POLICY, minLength: 2 })).toEqual([
      'minLength',
    ])
    expect(passwordProblems('a'.repeat(129), lenient)).toEqual(['maxLength'])
  })

  it('counts letters and symbols beyond ASCII', () => {
    // An umlaut is a letter, an emoji is one character and a symbol.
    expect(
      passwordProblems('Übung2026ä', { ...DEFAULT_PASSWORD_POLICY, requireSpecialChars: false })
    ).toEqual([])
    expect(passwordProblems('Pass1234😀', DEFAULT_PASSWORD_POLICY)).toEqual([])
    // Length is characters, not UTF-16 units: 5 characters (7 units) is short.
    expect(passwordProblems('Ab1😀😀', { ...lenient, minLength: 6 })).toEqual(['minLength'])
    expect(passwordProblems('Ab1😀😀😀', { ...lenient, minLength: 6 })).toEqual([])
  })
})

describe('policyRules and describeProblems', () => {
  it('lists the rules in force', () => {
    expect(policyRules(DEFAULT_PASSWORD_POLICY)).toEqual([
      'minLength',
      'uppercase',
      'lowercase',
      'number',
      'special',
    ])
    expect(policyRules(lenient)).toEqual(['minLength'])
  })

  it('says in one sentence what is missing', () => {
    expect(
      describeProblems(['minLength', 'uppercase', 'special'], {
        ...DEFAULT_PASSWORD_POLICY,
        minLength: 10,
      })
    ).toBe('Password must be at least 10 characters and include an uppercase letter and a symbol.')
    expect(describeProblems(['number'], DEFAULT_PASSWORD_POLICY)).toBe(
      'Password must include a number.'
    )
    expect(describeProblems(['maxLength'], DEFAULT_PASSWORD_POLICY)).toBe(
      'Password must be at most 128 characters.'
    )
  })
})

describe('policyFromSettings', () => {
  it('uses the defaults the settings page shows when nothing is saved', () => {
    expect(policyFromSettings([])).toEqual(DEFAULT_PASSWORD_POLICY)
  })

  it('reads the JSON-encoded values Settings → Security saves', () => {
    expect(
      policyFromSettings([
        { key: 'passwordMinLength', value: '12' },
        { key: 'passwordRequireUppercase', value: 'false' },
        { key: 'passwordRequireSpecialChars', value: 'false' },
      ])
    ).toEqual({
      minLength: 12,
      requireUppercase: false,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: false,
    })
  })

  it('keeps the length within what the settings page allows', () => {
    expect(policyFromSettings([{ key: 'passwordMinLength', value: '2' }]).minLength).toBe(6)
    expect(policyFromSettings([{ key: 'passwordMinLength', value: '99' }]).minLength).toBe(32)
    expect(policyFromSettings([{ key: 'passwordMinLength', value: '"oops"' }]).minLength).toBe(8)
  })
})
