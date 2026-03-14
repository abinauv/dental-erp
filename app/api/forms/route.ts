import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// GET: List form submissions for the hospital (staff view)
export async function GET(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const patientId = searchParams.get("patientId")
    const appointmentId = searchParams.get("appointmentId")
    const templateId = searchParams.get("templateId")
    const status = searchParams.get("status")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")

    const where: any = { hospitalId }
    if (patientId) where.patientId = patientId
    if (appointmentId) where.appointmentId = appointmentId
    if (templateId) where.templateId = templateId
    if (status) where.status = status

    const [submissions, total] = await Promise.all([
      prisma.formSubmission.findMany({
        where,
        include: {
          template: { select: { name: true, type: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.formSubmission.count({ where }),
    ])

    return NextResponse.json({ submissions, total, page, totalPages: Math.ceil(total / limit) })
  } catch (err) {
    console.error("List submissions error:", err)
    return NextResponse.json({ error: "Failed to list submissions" }, { status: 500 })
  }
}

// POST: Create a submission (staff creates on behalf of patient, or assigns form)
export async function POST(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { templateId, patientId, appointmentId, data, signature } = body

    if (!templateId) {
      return NextResponse.json({ error: "templateId is required" }, { status: 400 })
    }

    const template = await prisma.formTemplate.findFirst({
      where: { id: templateId, hospitalId },
    })
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    const submission = await prisma.formSubmission.create({
      data: {
        hospitalId,
        templateId,
        patientId: patientId || null,
        appointmentId: appointmentId || null,
        data: data || {},
        signature: signature || null,
        signedAt: signature ? new Date() : null,
      },
    })

    return NextResponse.json({ submission }, { status: 201 })
  } catch (err) {
    console.error("Create submission error:", err)
    return NextResponse.json({ error: "Failed to create submission" }, { status: 500 })
  }
}
