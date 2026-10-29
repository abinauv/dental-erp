import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { getAuthUrl } from '@/lib/services/outlook-calendar'

// GET /api/integrations/outlook-calendar/auth — Redirect to Microsoft OAuth
export async function GET(req: NextRequest) {
  const { error, session } = await requireAuthAndRole()
  if (error || !session) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.OUTLOOK_CALENDAR_CLIENT_ID) {
    return NextResponse.json(
      { error: 'Outlook Calendar integration is not configured' },
      { status: 400 }
    )
  }

  // State contains userId + hospitalId for the callback
  const state = Buffer.from(
    JSON.stringify({
      userId: session.user.id,
      hospitalId: session.user.hospitalId,
    })
  ).toString('base64url')

  const authUrl = getAuthUrl(state)

  return NextResponse.json({ authUrl })
}
