import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePatientAuth } from "@/lib/patient-auth"

// GET: List pending/completed forms for the patient
export async function GET(req: NextRequest) {
  const { error, patient } = await requirePatientAuth(req)
  if (error) return error

  try {
    const hospitalId = patient!.hospitalId
    const patientId = patient!.id

    // Get forms assigned to this patient or their appointments
    const submissions = await prisma.formSubmission.findMany({
      where: {
        hospitalId,
        patientId,
      },
      include: {
        template: {
          select: { id: true, name: true, type: true, description: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    // Get active templates available for this hospital (for new submissions)
    const availableTemplates = await prisma.formTemplate.findMany({
      where: {
        hospitalId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        type: true,
        description: true,
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json({ submissions, availableTemplates })
  } catch (err) {
    console.error("Patient forms error:", err)
    return NextResponse.json({ error: "Failed to load forms" }, { status: 500 })
  }
}

// POST: Submit a form
export async function POST(req: NextRequest) {
  const { error, patient } = await requirePatientAuth(req)
  if (error) return error

  try {
    const body = await req.json()
    const { templateId, data, signature, appointmentId } = body

    if (!templateId) {
      return NextResponse.json({ error: "templateId is required" }, { status: 400 })
    }

    const hospitalId = patient!.hospitalId
    const patientId = patient!.id

    // Verify template belongs to patient's hospital
    const template = await prisma.formTemplate.findFirst({
      where: { id: templateId, hospitalId, isActive: true },
    })
    if (!template) {
      return NextResponse.json({ error: "Form template not found" }, { status: 404 })
    }

    // Get client IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") || "unknown"

    const submission = await prisma.formSubmission.create({
      data: {
        hospitalId,
        templateId,
        patientId,
        appointmentId: appointmentId || null,
        data: data || {},
        signature: signature || null,
        signedAt: signature ? new Date() : null,
        ipAddress: ip,
      },
    })

    return NextResponse.json({ submission }, { status: 201 })
  } catch (err) {
    console.error("Patient form submit error:", err)
    return NextResponse.json({ error: "Failed to submit form" }, { status: 500 })
  }
}
