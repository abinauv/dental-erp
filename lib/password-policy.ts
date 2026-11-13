// A clinic's password rules (Settings → Security), and checking a password
// against them. Plain functions, so the server and the browser check the same
// way. Loading a clinic's rules is in lib/password-policy.server.ts.

export interface PasswordPolicy {
  minLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireNumbers: boolean
  requireSpecialChars: boolean
}

// What Settings → Security shows for a clinic that hasn't saved its own rules,
// so what an admin sees there is what's enforced.
export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
}

// The settings page allows 6–32. Longer than 128 is refused outright (bcrypt
// only reads the first 72 bytes anyway).
export const MIN_PASSWORD_LENGTH = 6
export const MAX_PASSWORD_LENGTH = 128

export type PasswordRule =
  'minLength' | 'maxLength' | 'uppercase' | 'lowercase' | 'number' | 'special'

/** The rules a password breaks, in a fixed order; empty when it's allowed. */
export function passwordProblems(password: string, policy: PasswordPolicy): PasswordRule[] {
  const problems: PasswordRule[] = []
  // Count characters, not UTF-16 units, so an emoji is one character.
  const length = [...password].length
  if (length < Math.max(policy.minLength, MIN_PASSWORD_LENGTH)) problems.push('minLength')
  if (length > MAX_PASSWORD_LENGTH) problems.push('maxLength')
  if (policy.requireUppercase && !/\p{Lu}/u.test(password)) problems.push('uppercase')
  if (policy.requireLowercase && !/\p{Ll}/u.test(password)) problems.push('lowercase')
  if (policy.requireNumbers && !/\p{Nd}/u.test(password)) problems.push('number')
  if (policy.requireSpecialChars && !/[^\p{L}\p{N}]/u.test(password)) problems.push('special')
  return problems
}

/** The rules that apply under this policy, for listing them to the person. */
export function policyRules(policy: PasswordPolicy): Exclude<PasswordRule, 'maxLength'>[] {
  const rules: Exclude<PasswordRule, 'maxLength'>[] = ['minLength']
  if (policy.requireUppercase) rules.push('uppercase')
  if (policy.requireLowercase) rules.push('lowercase')
  if (policy.requireNumbers) rules.push('number')
  if (policy.requireSpecialChars) rules.push('special')
  return rules
}

/** An English sentence for API errors (the UI shows its own translated list). */
export function describeProblems(problems: PasswordRule[], policy: PasswordPolicy): string {
  if (problems.includes('maxLength'))
    return `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`
  const needs: string[] = []
  if (problems.includes('uppercase')) needs.push('an uppercase letter')
  if (problems.includes('lowercase')) needs.push('a lowercase letter')
  if (problems.includes('number')) needs.push('a number')
  if (problems.includes('special')) needs.push('a symbol')
  const parts: string[] = []
  if (problems.includes('minLength'))
    parts.push(`be at least ${Math.max(policy.minLength, MIN_PASSWORD_LENGTH)} characters`)
  if (needs.length) {
    const list =
      needs.length > 1 ? `${needs.slice(0, -1).join(', ')} and ${needs.at(-1)}` : needs[0]
    parts.push(`include ${list}`)
  }
  return `Password must ${parts.join(' and ')}.`
}

/** Settings rows (category "security") → a policy, defaults filling gaps. */
export function policyFromSettings(rows: { key: string; value: string }[]): PasswordPolicy {
  const read = (key: string): unknown => {
    const row = rows.find((r) => r.key === key)
    if (!row) return undefined
    try {
      return JSON.parse(row.value)
    } catch {
      return row.value
    }
  }
  const bool = (key: string, fallback: boolean) => {
    const v = read(key)
    return typeof v === 'boolean' ? v : fallback
  }
  const min = Number(read('passwordMinLength'))
  return {
    minLength: Number.isInteger(min)
      ? Math.min(Math.max(min, MIN_PASSWORD_LENGTH), 32)
      : DEFAULT_PASSWORD_POLICY.minLength,
    requireUppercase: bool('passwordRequireUppercase', DEFAULT_PASSWORD_POLICY.requireUppercase),
    requireLowercase: bool('passwordRequireLowercase', DEFAULT_PASSWORD_POLICY.requireLowercase),
    requireNumbers: bool('passwordRequireNumbers', DEFAULT_PASSWORD_POLICY.requireNumbers),
    requireSpecialChars: bool(
      'passwordRequireSpecialChars',
      DEFAULT_PASSWORD_POLICY.requireSpecialChars
    ),
  }
}
