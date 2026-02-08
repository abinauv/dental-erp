import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePatientAuth } from "@/lib/patient-auth"

// GET: Get a specific form template with fields (for patient to fill)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error, patient } = await requirePatientAuth(req)
  if (error) return error

  try {
    const hospitalId = patient!.hospitalId

    const template = await prisma.formTemplate.findFirst({
      where: { id, hospitalId, isActive: true },
    })

    if (!template) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 })
    }

    // Check if patient already submitted this form
    const existingSubmission = await prisma.formSubmission.findFirst({
      where: {
        templateId: id,
        patientId: patient!.id,
        hospitalId,
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      template,
      existingSubmission,
    })
  } catch (err) {
    console.error("Patient form detail error:", err)
    return NextResponse.json({ error: "Failed to load form" }, { status: 500 })
  }
}
