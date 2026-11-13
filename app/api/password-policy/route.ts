import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPasswordPolicy } from '@/lib/password-policy.server'
import { userIdForResetToken } from '@/lib/auth-passwords'

/**
 * GET /api/password-policy
 * The password rules that apply to someone choosing a new password:
 * - ?resetToken=… for the reset page (not signed in). 404 when the link has
 *   expired or was used.
 * - otherwise the signed-in user's, with whether they must change it now. It
 *   reads the session directly so it still works while a change is required
 *   (the usual API helpers refuse until then).
 */
export async function GET(req: NextRequest) {
  const resetToken = req.nextUrl.searchParams.get('resetToken')

  let userId: string | null = null
  if (resetToken) {
    userId = await userIdForResetToken(resetToken)
    if (!userId) {
      return NextResponse.json(
        { error: 'This link has expired or was already used.', code: 'INVALID_TOKEN' },
        { status: 404 }
      )
    }
  } else {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    userId = session.user.id
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { hospitalId: true, mustChangePassword: true },
  })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({
    passwordPolicy: await getPasswordPolicy(user.hospitalId),
    ...(!resetToken && { mustChangePassword: user.mustChangePassword }),
  })
}
