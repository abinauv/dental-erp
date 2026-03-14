import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

/**
 * POST /api/devices/register — Register a new IoT device
 */
export async function POST(request: NextRequest) {
  try {
    const { error, user, hospitalId } = await requireAuthAndRole(["ADMIN"])
    if (error) return error

    const body = await request.json()
    const { name, type, serialNumber, location, ipAddress, firmwareVersion, metadata } = body

    if (!name || !type) {
      return NextResponse.json(
        { error: "Name and type are required" },
        { status: 400 }
      )
    }

    const validTypes = [
      "DENTAL_CHAIR", "PULSE_OXIMETER", "BP_MONITOR",
      "AUTOCLAVE", "XRAY", "COMPRESSOR", "SENSOR", "OTHER",
    ]
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid device type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      )
    }

    // Check for duplicate serial number in this hospital
    if (serialNumber) {
      const existing = await prisma.device.findFirst({
        where: { hospitalId: hospitalId!, serialNumber },
      })
      if (existing) {
        return NextResponse.json(
          { error: "A device with this serial number already exists" },
          { status: 409 }
        )
      }
    }

    const device = await prisma.device.create({
      data: {
        hospitalId: hospitalId!,
        name,
        type,
        serialNumber: serialNumber || null,
        location: location || null,
        ipAddress: ipAddress || null,
        firmwareVersion: firmwareVersion || null,
        metadata: metadata || null,
        status: "OFFLINE",
      },
    })

    return NextResponse.json(device, { status: 201 })
  } catch (err) {
    console.error("Device registration error:", err)
    return NextResponse.json({ error: "Failed to register device" }, { status: 500 })
  }
}
