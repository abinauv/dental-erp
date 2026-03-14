import { NextRequest, NextResponse } from "next/server"
import { requireAuthAndRole } from "@/lib/api-helpers"
import prisma from "@/lib/prisma"

// POST /api/integrations/google-calendar/disconnect — Remove integration
export async function POST(req: NextRequest) {
  const { error, session } = await requireAuthAndRole()
  if (error || !session) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await prisma.calendarIntegration.deleteMany({
      where: {
        userId: session.user.id,
        provider: "GOOGLE",
      },
    })

    return NextResponse.json({ message: "Google Calendar disconnected" })
  } catch (err) {
    console.error("Error disconnecting calendar:", err)
    return NextResponse.json(
      { error: "Failed to disconnect calendar" },
      { status: 500 }
    )
  }
}
