import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { logger } from './logger'

// Better Auth's email/password sign-in verifies the hash stored on the user's
// `credential` BaAccount row, while the mobile token route and the app's own
// user management read and write User.password. The two must always hold the
// same bcrypt hash: a user created with only User.password set cannot sign in
// on the web, and a password reset that misses BaAccount leaves the old
// password working there.
//
// Every place that sets a password writes User.password as before and then
// calls syncCredentialAccount() inside the same transaction. For credential
// writes Better Auth makes itself, lib/auth registers
// mirrorCredentialPassword() as an account database hook.

export const CREDENTIAL_PROVIDER_ID = 'credential'

// Matches the id the 20261029130000 backfill used, so a user can never end up
// with two credential rows from the app (a concurrent second create hits the
// primary key instead).
export function credentialAccountId(userId: string): string {
  return `bacred_${userId}`
}

type Db = Pick<Prisma.TransactionClient, 'baAccount'>

/** Point the user's Better Auth credential at `passwordHash` (a bcrypt hash). */
export async function syncCredentialAccount(
  db: Db,
  userId: string,
  passwordHash: string
): Promise<void> {
  const { count } = await db.baAccount.updateMany({
    where: { userId, providerId: CREDENTIAL_PROVIDER_ID },
    data: { password: passwordHash },
  })
  if (count > 0) return

  await db.baAccount.create({
    data: {
      id: credentialAccountId(userId),
      accountId: userId,
      providerId: CREDENTIAL_PROVIDER_ID,
      userId,
      password: passwordHash,
    },
  })
}

// Copy a credential hash Better Auth wrote (e.g. via its /change-password
// endpoint) back onto User.password. It runs after the account write has
// committed, so a failure is logged rather than thrown: the new password is
// already in effect for web sign-in.
export async function mirrorCredentialPassword(account: {
  providerId?: unknown
  userId?: unknown
  password?: unknown
}): Promise<void> {
  if (account.providerId !== CREDENTIAL_PROVIDER_ID) return
  if (typeof account.userId !== 'string' || typeof account.password !== 'string') return
  try {
    await prisma.user.update({
      where: { id: account.userId },
      data: { password: account.password },
    })
  } catch (err) {
    logger.error(
      { err, userId: account.userId },
      'Failed to mirror credential password to User.password'
    )
  }
}
