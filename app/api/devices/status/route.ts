import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

/**
 * GET /api/devices/status — Get all devices and their statuses
 */
export async function GET(request: NextRequest) {
  try {
    const { error, hospitalId } = await requireAuthAndRole(["ADMIN", "DOCTOR"])
    if (error) return error

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type")
    const status = searchParams.get("status")

    const where: Record<string, unknown> = { hospitalId: hospitalId! }
    if (type) where.type = type
    if (status) where.status = status

    const devices = await prisma.device.findMany({
      where,
      include: {
        dataLogs: {
          orderBy: { timestamp: "desc" },
          take: 1,
          select: {
            id: true,
            data: true,
            eventType: true,
            timestamp: true,
          },
        },
      },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    })

    // Mark devices as OFFLINE if no ping in 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    const staleDevices = devices.filter(
      (d) => d.status === "ONLINE" && d.lastPingAt && d.lastPingAt < fiveMinutesAgo
    )
    if (staleDevices.length > 0) {
      await prisma.device.updateMany({
        where: { id: { in: staleDevices.map((d) => d.id) } },
        data: { status: "OFFLINE" },
      })
      // Update local results
      staleDevices.forEach((d) => { (d as Record<string, unknown>).status = "OFFLINE" })
    }

    // Summary stats
    const summary = {
      total: devices.length,
      online: devices.filter((d) => d.status === "ONLINE").length,
      offline: devices.filter((d) => d.status === "OFFLINE").length,
      error: devices.filter((d) => d.status === "ERROR").length,
      maintenance: devices.filter((d) => d.status === "MAINTENANCE").length,
    }

    return NextResponse.json({ devices, summary })
  } catch (err) {
    console.error("Device status error:", err)
    return NextResponse.json({ error: "Failed to fetch device statuses" }, { status: 500 })
  }
}

/**
 * PUT /api/devices/status — Update a device's status or details
 */
export async function PUT(request: NextRequest) {
  try {
    const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])
    if (error) return error

    const body = await request.json()
    const { id, name, type, location, status, serialNumber, ipAddress, firmwareVersion, metadata } = body

    if (!id) {
      return NextResponse.json({ error: "Device id is required" }, { status: 400 })
    }

    const device = await prisma.device.findFirst({
      where: { id, hospitalId: hospitalId! },
    })
    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (type !== undefined) updateData.type = type
    if (location !== undefined) updateData.location = location
    if (status !== undefined) updateData.status = status
    if (serialNumber !== undefined) updateData.serialNumber = serialNumber
    if (ipAddress !== undefined) updateData.ipAddress = ipAddress
    if (firmwareVersion !== undefined) updateData.firmwareVersion = firmwareVersion
    if (metadata !== undefined) updateData.metadata = metadata

    const updated = await prisma.device.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error("Device update error:", err)
    return NextResponse.json({ error: "Failed to update device" }, { status: 500 })
  }
}

/**
 * DELETE /api/devices/status — Remove a device
 */
export async function DELETE(request: NextRequest) {
  try {
    const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])
    if (error) return error

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Device id is required" }, { status: 400 })
    }

    const device = await prisma.device.findFirst({
      where: { id, hospitalId: hospitalId! },
    })
    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    await prisma.device.delete({ where: { id } })

    return NextResponse.json({ deleted: true })
  } catch (err) {
    console.error("Device delete error:", err)
    return NextResponse.json({ error: "Failed to delete device" }, { status: 500 })
  }
}
