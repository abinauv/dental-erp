import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { exchangeCodeForTokens, listCalendars } from "@/lib/services/google-calendar"

// GET /api/integrations/google-calendar/callback — OAuth callback
export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code")
    const state = req.nextUrl.searchParams.get("state")
    const errorParam = req.nextUrl.searchParams.get("error")

    if (errorParam) {
      // User denied access
      return NextResponse.redirect(new URL("/settings/integrations?error=denied", req.url))
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL("/settings/integrations?error=missing_params", req.url))
    }

    // Decode state
    let userId: string, hospitalId: string
    try {
      const decoded = JSON.parse(Buffer.from(state, "base64url").toString())
      userId = decoded.userId
      hospitalId = decoded.hospitalId
    } catch {
      return NextResponse.redirect(new URL("/settings/integrations?error=invalid_state", req.url))
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code)

    // Get user's primary calendar ID
    let calendarId = "primary"
    try {
      const calendars = await listCalendars(tokens.access_token)
      const primary = calendars.find((c: any) => c.primary)
      if (primary) calendarId = primary.id
    } catch {
      // Default to "primary"
    }

    // Upsert the integration record
    await prisma.calendarIntegration.upsert({
      where: {
        userId_provider: {
          userId,
          provider: "GOOGLE",
        },
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        calendarId,
        syncEnabled: true,
      },
      create: {
        hospitalId,
        userId,
        provider: "GOOGLE",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        calendarId,
        syncEnabled: true,
      },
    })

    return NextResponse.redirect(new URL("/settings/integrations?success=connected", req.url))
  } catch (err) {
    console.error("Google Calendar callback error:", err)
    return NextResponse.redirect(new URL("/settings/integrations?error=token_exchange", req.url))
  }
}
