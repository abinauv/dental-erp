'use client'

import { Check, Circle } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  passwordProblems,
  policyRules,
  type PasswordPolicy,
} from '@/lib/password-policy'

/** The clinic's password rules, each ticked off as the password meets it. */
export function PasswordRules({
  policy,
  password,
  id,
}: {
  policy: PasswordPolicy
  password: string
  id?: string
}) {
  const t = useTranslations('auth.passwordRules')
  const problems = passwordProblems(password, policy)
  const minLength = Math.max(policy.minLength, MIN_PASSWORD_LENGTH)

  return (
    <div id={id} className="rounded-md border bg-muted/40 p-3 text-sm">
      <p className="mb-1 font-medium">{t('title')}</p>
      <ul className="space-y-1">
        {policyRules(policy).map((rule) => {
          const met = password.length > 0 && !problems.includes(rule)
          return (
            <li
              key={rule}
              className={cn(
                'flex items-center gap-2',
                met ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'
              )}
            >
              {met ? (
                <Check className="h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <Circle className="mx-0.5 h-3 w-3 shrink-0" aria-hidden />
              )}
              <span>{t(rule, { count: minLength })}</span>
              <span className="sr-only">({met ? t('met') : t('notMet')})</span>
            </li>
          )
        })}
        {problems.includes('maxLength') && (
          <li className="text-destructive">{t('maxLength', { count: MAX_PASSWORD_LENGTH })}</li>
        )}
      </ul>
    </div>
  )
}
