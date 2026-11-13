// Password change and reset, on top of Better Auth's own endpoints
// (/change-password, /request-password-reset, /reset-password). Wired up in
// lib/auth.ts.

import { APIError } from 'better-auth/api'
import { prisma } from './prisma'
import { CREDENTIAL_PROVIDER_ID } from './auth-credentials'
import { PasswordPolicyError, assertPasswordAllowed } from './password-policy.server'
import { sendPasswordResetEmail } from './email-helpers'
import { logger } from './logger'

/** Who a reset token belongs to, while it's still valid. */
export async function userIdForResetToken(token: string): Promise<string | null> {
  const row = await prisma.baVerification.findFirst({
    where: { identifier: `reset-password:${token}`, expiresAt: { gt: new Date() } },
    select: { value: true },
  })
  return row?.value ?? null
}

async function hospitalOf(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { hospitalId: true } })
  return user?.hospitalId ?? null
}

/**
 * Before Better Auth sets a new password: it must follow the clinic's rules,
 * and a change must actually change it. Throws an APIError (400) otherwise.
 * `userId` is the signed-in user for a change; for a reset it comes from the
 * token (an invalid token is left for Better Auth to refuse).
 */
export async function checkNewPassword(args: {
  path: string
  userId: string | null
  newPassword: unknown
  currentPassword?: unknown
}): Promise<void> {
  const { path, userId, newPassword, currentPassword } = args
  if (path !== '/change-password' && path !== '/reset-password') return
  if (!userId || typeof newPassword !== 'string') return

  if (path === '/change-password' && newPassword === currentPassword) {
    throw new APIError('BAD_REQUEST', {
      message: 'Choose a password different from your current one.',
      code: 'PASSWORD_UNCHANGED',
    })
  }

  const hospitalId = await hospitalOf(userId)
  if (!hospitalId) return
  try {
    await assertPasswordAllowed(hospitalId, newPassword)
  } catch (err) {
    if (err instanceof PasswordPolicyError) {
      throw new APIError('BAD_REQUEST', { message: err.message, code: err.code })
    }
    throw err
  }
}

/**
 * Email a reset link. Only to an active user of an active clinic; Better Auth
 * answers the same either way, so nobody learns which emails have accounts.
 */
export async function sendResetLink(data: {
  user: { id: string; email: string; name?: string | null }
  url: string
  token: string
}): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: data.user.id },
    select: {
      isActive: true,
      name: true,
      email: true,
      hospitalId: true,
      hospital: { select: { isActive: true } },
    },
  })
  if (!user?.isActive || !user.hospital?.isActive) {
    logger.info({ userId: data.user.id }, '[auth] password reset not sent: account inactive')
    return
  }
  await sendPasswordResetEmail({
    hospitalId: user.hospitalId,
    to: user.email,
    userName: user.name,
    url: data.url,
    token: data.token,
  })
}

/**
 * After a reset: Better Auth wrote the new hash to the credential account
 * through an update the account hook can't see, so copy it to User.password
 * (the mobile app signs in against that) and clear mustChangePassword (the
 * person chose this password).
 */
export async function afterPasswordReset({ user }: { user: { id: string } }): Promise<void> {
  const account = await prisma.baAccount.findFirst({
    where: { userId: user.id, providerId: CREDENTIAL_PROVIDER_ID },
    select: { password: true },
  })
  if (!account?.password) return
  await prisma.user.update({
    where: { id: user.id },
    data: { password: account.password, mustChangePassword: false },
  })
}
