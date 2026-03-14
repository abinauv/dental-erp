import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePatientAuth } from "@/lib/patient-auth"

/**
 * GET: List doctors for the patient's hospital.
 */
export async function GET(req: NextRequest) {
  const { error, patient } = await requirePatientAuth(req)
  if (error) return error

  try {
    const doctors = await prisma.staff.findMany({
      where: {
        hospitalId: patient!.hospitalId,
        isActive: true,
        user: { role: "DOCTOR" },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        specialization: true,
      },
      orderBy: { firstName: "asc" },
    })

    return NextResponse.json({ doctors })
  } catch (err: unknown) {
    console.error("Portal doctors error:", err)
    return NextResponse.json(
      { error: "Failed to fetch doctors" },
      { status: 500 }
    )
  }
}
