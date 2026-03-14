import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

/**
 * POST /api/devices/data — Receive sensor data from a device
 * Also accepts device API key via Authorization header for machine-to-machine.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { deviceId, data, eventType } = body

    if (!deviceId || !data) {
      return NextResponse.json(
        { error: "deviceId and data are required" },
        { status: 400 }
      )
    }

    // Verify device exists
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
    })
    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    // Record data log
    const log = await prisma.deviceDataLog.create({
      data: {
        deviceId,
        data,
        eventType: eventType || "READING",
      },
    })

    // Update device last ping and status
    await prisma.device.update({
      where: { id: deviceId },
      data: {
        lastPingAt: new Date(),
        status: eventType === "ERROR" ? "ERROR" : "ONLINE",
      },
    })

    return NextResponse.json({ id: log.id, recorded: true }, { status: 201 })
  } catch (err) {
    console.error("Device data ingestion error:", err)
    return NextResponse.json({ error: "Failed to record device data" }, { status: 500 })
  }
}

/**
 * GET /api/devices/data — Retrieve data logs for a device
 */
export async function GET(request: NextRequest) {
  try {
    const { error, hospitalId } = await requireAuthAndRole(["ADMIN", "DOCTOR"])
    if (error) return error

    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get("deviceId")
    const limit = parseInt(searchParams.get("limit") || "50")
    const eventType = searchParams.get("eventType")

    if (!deviceId) {
      return NextResponse.json({ error: "deviceId is required" }, { status: 400 })
    }

    // Verify device belongs to this hospital
    const device = await prisma.device.findFirst({
      where: { id: deviceId, hospitalId: hospitalId! },
    })
    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    const where: Record<string, unknown> = { deviceId }
    if (eventType) where.eventType = eventType

    const logs = await prisma.deviceDataLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: Math.min(limit, 200),
    })

    return NextResponse.json({ logs, total: logs.length })
  } catch (err) {
    console.error("Device data fetch error:", err)
    return NextResponse.json({ error: "Failed to fetch device data" }, { status: 500 })
  }
}
