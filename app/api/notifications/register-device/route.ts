import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const registerSchema = z.object({
  token: z.string().min(1, "Push token is required"),
  platform: z.enum(["ios", "android", "web"]),
  deviceName: z.string().optional(),
})

// Register a device for push notifications
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const validated = registerSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validated.error.flatten() },
        { status: 400 }
      )
    }

    const { token, platform, deviceName } = validated.data

    // Upsert device token - update if same token exists, create if new
    await prisma.pushDevice.upsert({
      where: {
        token: token,
      },
      update: {
        platform,
        deviceName: deviceName || null,
        userId: session.user.id as string,
        hospitalId: session.user.hospitalId as string,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        token,
        platform,
        deviceName: deviceName || null,
        userId: session.user.id as string,
        hospitalId: session.user.hospitalId as string,
        isActive: true,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Device registration error:", error)
    return NextResponse.json(
      { error: "Failed to register device" },
      { status: 500 }
    )
  }
}

// Unregister device (on logout)
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      )
    }

    await prisma.pushDevice.updateMany({
      where: {
        token,
        userId: session.user.id as string,
      },
      data: {
        isActive: false,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Device unregister error:", error)
    return NextResponse.json(
      { error: "Failed to unregister device" },
      { status: 500 }
    )
  }
}
