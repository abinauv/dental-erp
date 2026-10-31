'use client'

import { createAuthClient } from 'better-auth/react'

// Browser-side Better Auth client. Base client covers signIn.email / signOut /
// useSession; OIDC/SSO sign-in goes through the generic-oauth endpoint below.
export const authClient = createAuthClient()

export const { signIn, signOut, useSession } = authClient

// Whether the SSO button should render. Server-side OIDC is gated on
// OIDC_ISSUER; the client mirrors that with a public flag so the button only
// appears when SSO is actually configured.
export const oidcEnabled = process.env.NEXT_PUBLIC_OIDC_ENABLED === 'true'

/**
 * Start the OIDC/SSO flow. The generic-oauth plugin exposes
 * POST /sign-in/oauth2, which returns the identity provider's authorize URL;
 * we navigate the browser there to complete the redirect handshake.
 */
export async function signInWithOidc(callbackURL: string): Promise<void> {
  const { data } = await authClient.$fetch<{ url?: string; redirect?: boolean }>(
    '/sign-in/oauth2',
    {
      method: 'POST',
      body: { providerId: 'oidc', callbackURL },
    }
  )
  if (data?.url) {
    window.location.href = data.url
  }
}
