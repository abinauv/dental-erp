import { NextRequest, NextResponse } from "next/server"
import { requireAuthAndRole } from "@/lib/api-helpers"
import prisma from "@/lib/prisma"
import { syncAppointments } from "@/lib/services/google-calendar"

// POST /api/integrations/google-calendar/sync — Trigger sync
export async function POST(req: NextRequest) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId || !session) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const integration = await prisma.calendarIntegration.findUnique({
      where: {
        userId_provider: {
          userId: session.user.id,
          provider: "GOOGLE",
        },
      },
    })

    if (!integration) {
      return NextResponse.json(
        { error: "Google Calendar not connected. Please connect first." },
        { status: 400 }
      )
    }

    if (!integration.syncEnabled) {
      return NextResponse.json(
        { error: "Calendar sync is disabled" },
        { status: 400 }
      )
    }

    const result = await syncAppointments(integration.id, hospitalId, session.user.id)

    return NextResponse.json({
      message: `Synced ${result.synced} appointments${result.errors > 0 ? ` (${result.errors} errors)` : ""}`,
      ...result,
    })
  } catch (err) {
    console.error("Calendar sync error:", err)
    return NextResponse.json(
      { error: "Failed to sync calendar" },
      { status: 500 }
    )
  }
}

// GET /api/integrations/google-calendar/sync — Get sync status
export async function GET(req: NextRequest) {
  const { error, session } = await requireAuthAndRole()
  if (error || !session) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const integration = await prisma.calendarIntegration.findUnique({
      where: {
        userId_provider: {
          userId: session.user.id,
          provider: "GOOGLE",
        },
      },
      select: {
        id: true,
        provider: true,
        calendarId: true,
        syncEnabled: true,
        lastSyncAt: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      connected: !!integration,
      integration,
    })
  } catch (err) {
    console.error("Error fetching sync status:", err)
    return NextResponse.json(
      { error: "Failed to fetch sync status" },
      { status: 500 }
    )
  }
}
