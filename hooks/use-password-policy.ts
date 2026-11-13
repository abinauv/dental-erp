'use client'

import { useEffect, useState } from 'react'
import { DEFAULT_PASSWORD_POLICY, type PasswordPolicy } from '@/lib/password-policy'

export interface PasswordPolicyState {
  status: 'loading' | 'ready' | 'invalid'
  policy: PasswordPolicy
  /** Signed in and required to choose a new password now. */
  mustChangePassword: boolean
}

/**
 * The password rules for whoever is choosing a new password: the signed-in
 * user's clinic, or with `resetToken` the clinic of the account being reset
 * ('invalid' when that link has expired or was used). If the rules can't be
 * loaded the defaults are shown; the server checks the real ones either way.
 */
export function usePasswordPolicy(resetToken?: string | null): PasswordPolicyState {
  const [state, setState] = useState<PasswordPolicyState>({
    status: 'loading',
    policy: DEFAULT_PASSWORD_POLICY,
    mustChangePassword: false,
  })

  useEffect(() => {
    let cancelled = false
    const url = resetToken
      ? `/api/password-policy?resetToken=${encodeURIComponent(resetToken)}`
      : '/api/password-policy'
    fetch(url)
      .then(async (res) => {
        if (cancelled) return
        if (res.status === 404 && resetToken) {
          setState((s) => ({ ...s, status: 'invalid' }))
          return
        }
        const data = res.ok ? await res.json() : {}
        if (cancelled) return
        setState({
          status: 'ready',
          policy: data.passwordPolicy ?? DEFAULT_PASSWORD_POLICY,
          mustChangePassword: !!data.mustChangePassword,
        })
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, status: 'ready' }))
      })
    return () => {
      cancelled = true
    }
  }, [resetToken])

  return state
}
