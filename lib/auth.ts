import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { nextCookies } from 'better-auth/next-js'
import { genericOAuth, customSession } from 'better-auth/plugins'
import { APIError } from 'better-auth/api'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { mirrorCredentialPassword } from './auth-credentials'
import { trustedProxies } from './trusted-proxies'

// Better Auth replaces next-auth as the staff/web session layer. The two
// independent token paths are unchanged and intentionally NOT routed through
// Better Auth: the mobile Bearer JWT (app/api/auth/mobile-token + lib/api-helpers)
// and the patient OTP cookie (lib/patient-auth) are both plain jose JWTs signed
// with NEXTAUTH_SECRET, so they keep working as-is.
//
// Design notes:
// - Better Auth's `user` is mapped onto the existing `User` table so every app
//   relation keeps working. Its boolean `emailVerified` maps to a new column
//   (`emailVerifiedBa`) because the app already uses a DateTime `emailVerified`.
// - Sessions/accounts/verifications live in new `BaSession`/`BaAccount`/
//   `BaVerification` tables (the vestigial next-auth-shaped Account/Session/
//   VerificationToken models were unused and are left alone).
// - Passwords are bcrypt and live in two places that must agree: Better Auth
//   verifies the credential `BaAccount` row, while the mobile token route and
//   the app's user management use `User.password`. App code writes both via
//   syncCredentialAccount (lib/auth-credentials); the account hooks below cover
//   writes Better Auth makes itself. Migrations backfilled and re-synced the
//   rows, and the custom hash/verify keep bcrypt so no one had to reset.
// - Users are only ever created by the app, so Better Auth sign-up is disabled
//   (email/password and SSO).

// Keep bcrypt for both hashing new passwords and verifying existing hashes, so
// the migration needs no password resets. Exported for tests.
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}
export function verifyPassword(data: { password: string; hash: string }): Promise<boolean> {
  return bcrypt.compare(data.password, data.hash)
}

const oidcIssuer = process.env.OIDC_ISSUER
const oidcEnabled = !!oidcIssuer

// OIDC/SSO is additive and configuration-gated: with OIDC_ISSUER unset the
// providers list is empty and the login UI is credentials-only (no change).
const oidcPlugins = oidcEnabled
  ? [
      genericOAuth({
        config: [
          {
            providerId: 'oidc',
            discoveryUrl: `${oidcIssuer!.replace(/\/$/, '')}/.well-known/openid-configuration`,
            clientId: process.env.OIDC_CLIENT_ID || '',
            clientSecret: process.env.OIDC_CLIENT_SECRET || '',
            scopes: ['openid', 'email', 'profile'],
            // SSO signs existing staff in (matched by verified email); it never
            // creates users. Every user must belong to a hospital, which only
            // the app's signup / invite / staff flows can provide.
            disableSignUp: true,
          },
        ],
      }),
    ]
  : []

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'mysql' }),
  secret: process.env.NEXTAUTH_SECRET,
  baseURL: process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    // Users are created by the app (clinic signup, invites, staff management,
    // data import), never through Better Auth's own /sign-up/email endpoint.
    disableSignUp: true,
    // Preserve existing bcrypt hashes (and keep hashing new passwords with
    // bcrypt) so the migration needs no password resets.
    password: { hash: hashPassword, verify: verifyPassword },
  },

  user: {
    modelName: 'User',
    // App uses a DateTime `emailVerified`; Better Auth needs a boolean, so give
    // it its own column.
    fields: { emailVerified: 'emailVerifiedBa' },
    // Server-owned fields surfaced on the session user. input:false stops
    // clients from setting them at sign-up.
    additionalFields: {
      role: { type: 'string', input: false, required: false },
      hospitalId: { type: 'string', input: false, required: false },
      isHospitalAdmin: { type: 'boolean', input: false, required: false, defaultValue: false },
    },
  },
  session: {
    modelName: 'BaSession',
    expiresIn: 8 * 60 * 60, // 8 hours, matching the previous JWT maxAge
    // Short signed cookie cache so middleware can read role without a DB hit.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  account: {
    modelName: 'BaAccount',
    // Let an existing staff member sign in with OIDC when the verified email
    // matches their account (so SSO maps onto their real hospital/role).
    accountLinking: oidcEnabled
      ? { enabled: true, trustedProviders: ['oidc'] }
      : { enabled: false },
  },
  verification: { modelName: 'BaVerification' },

  // Built-in brute-force protection (11.3): throttle auth endpoints. Login gets
  // a tight window; the rest of /api/auth uses the default.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-in/oauth2': { window: 60, max: 10 },
    },
  },
  // Which X-Forwarded-For entry is the client: see lib/trusted-proxies.ts.
  advanced: {
    ipAddress: { trustedProxies: trustedProxies() },
  },

  databaseHooks: {
    session: {
      create: {
        // Enforce the same gate the old Credentials.authorize had: a disabled
        // user or a disabled/missing hospital cannot get a session.
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { isActive: true, hospital: { select: { isActive: true } } },
          })
          if (!user || !user.isActive || !user.hospital || !user.hospital.isActive) {
            throw new APIError('UNAUTHORIZED', { message: 'Account or clinic is inactive' })
          }
          return { data: session }
        },
      },
    },
    // Keep User.password in step when Better Auth itself writes a credential
    // (e.g. its /change-password endpoint). App code syncs the other direction
    // through syncCredentialAccount (lib/auth-credentials).
    account: {
      create: { after: mirrorCredentialPassword },
      update: { after: mirrorCredentialPassword },
    },
  },

  plugins: [
    ...oidcPlugins,
    // Add staffId (a Staff relation, not a User column) to the session user so
    // callers that read session.user.staffId keep working.
    customSession(async ({ user, session }) => {
      const staff = await prisma.staff.findFirst({
        where: { userId: user.id },
        select: { id: true },
      })
      return { ...session, user: { ...user, staffId: staff?.id } }
    }),
    // Must be last: lets Server Actions / route handlers persist Set-Cookie.
    nextCookies(),
  ],
})

export type AppSession = typeof auth.$Infer.Session

// Read the staff/web session in a Server Component, route handler, or server
// action. Replaces next-auth's `auth()`; returns { user, session } | null.
export async function getServerSession() {
  const { headers } = await import('next/headers')
  return auth.api.getSession({ headers: await headers() })
}

// Helper: current staff user (web session) or null.
export async function getCurrentUser() {
  const session = await getServerSession()
  return session?.user ?? null
}

// Role helpers (unchanged — imported across the app).
export function hasRole(userRole: string, allowedRoles: string[]): boolean {
  return allowedRoles.includes(userRole)
}

export const roleHierarchy: Record<string, number> = {
  ADMIN: 5,
  DOCTOR: 4,
  ACCOUNTANT: 3,
  RECEPTIONIST: 2,
  LAB_TECH: 1,
}

export function hasMinimumRole(userRole: string, minimumRole: string): boolean {
  return (roleHierarchy[userRole] || 0) >= (roleHierarchy[minimumRole] || 0)
}
