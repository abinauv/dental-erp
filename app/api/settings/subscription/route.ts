import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

export async function GET() {
  const { error, hospitalId } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: {
        name: true,
        plan: true,
        maxPatients: true,
        maxStaff: true,
        maxStorageMB: true,
      },
    })

    if (!hospital) {
      return NextResponse.json({ error: "Hospital not found" }, { status: 404 })
    }

    // Get current usage counts
    const [patientCount, staffCount] = await Promise.all([
      prisma.patient.count({ where: { hospitalId } }),
      prisma.user.count({ where: { hospitalId, isActive: true } }),
    ])

    // TODO: Calculate actual storage usage from documents table
    const storageUsageMB = 0

    return NextResponse.json({
      name: hospital.name,
      plan: hospital.plan,
      maxPatients: hospital.maxPatients,
      maxStaff: hospital.maxStaff,
      maxStorageMB: hospital.maxStorageMB,
      currentPatients: patientCount,
      currentStaff: staffCount,
      currentStorageMB: storageUsageMB,
    })
  } catch (error) {
    console.error("Get subscription error:", error)
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    )
  }
}
