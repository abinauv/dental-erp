import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePatientAuth } from "@/lib/patient-auth"

/**
 * GET: Patient's prescriptions list.
 */
export async function GET(req: NextRequest) {
  const { error, patient } = await requirePatientAuth(req)
  if (error) return error

  try {
    const prescriptions = await prisma.prescription.findMany({
      where: {
        patientId: patient!.id,
        hospitalId: patient!.hospitalId,
      },
      include: {
        doctor: {
          select: { firstName: true, lastName: true, specialization: true },
        },
        medications: {
          include: {
            medication: {
              select: { name: true, genericName: true, form: true, strength: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ prescriptions })
  } catch (err: unknown) {
    console.error("Patient prescriptions error:", err)
    return NextResponse.json(
      { error: "Failed to load prescriptions" },
      { status: 500 }
    )
  }
}
