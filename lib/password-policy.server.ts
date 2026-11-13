import { prisma } from '@/lib/prisma'
import {
  describeProblems,
  passwordProblems,
  policyFromSettings,
  type PasswordPolicy,
  type PasswordRule,
} from '@/lib/password-policy'

const POLICY_KEYS = [
  'passwordMinLength',
  'passwordRequireUppercase',
  'passwordRequireLowercase',
  'passwordRequireNumbers',
  'passwordRequireSpecialChars',
]

/** The clinic's password rules from Settings → Security, or the defaults. */
export async function getPasswordPolicy(hospitalId: string): Promise<PasswordPolicy> {
  const rows = await prisma.setting.findMany({
    where: { hospitalId, category: 'security', key: { in: POLICY_KEYS } },
    select: { key: true, value: true },
  })
  return policyFromSettings(rows)
}

/** A password that breaks the clinic's rules; `message` is English. */
export class PasswordPolicyError extends Error {
  readonly code = 'PASSWORD_POLICY'
  constructor(
    readonly problems: PasswordRule[],
    readonly policy: PasswordPolicy
  ) {
    super(describeProblems(problems, policy))
  }
}

/** Throw PasswordPolicyError unless the password meets the clinic's rules. */
export async function assertPasswordAllowed(hospitalId: string, password: string): Promise<void> {
  const policy = await getPasswordPolicy(hospitalId)
  const problems = passwordProblems(password, policy)
  if (problems.length) throw new PasswordPolicyError(problems, policy)
}
