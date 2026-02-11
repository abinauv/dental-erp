import { NextResponse } from "next/server"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { prisma } from "@/lib/prisma"
import { generateFormPdfHtml } from "@/lib/services/pdf-generator"

/**
 * GET /api/forms/[id]/pdf
 * Generate and download a PDF-ready HTML document for a form submission.
 * Served as HTML with print-optimized CSS — use browser print-to-PDF or
 * content-disposition for download.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN", "DOCTOR", "RECEPTIONIST"])
  if (error) return error

  const { id } = await params

  const submission = await prisma.formSubmission.findFirst({
    where: { id, hospitalId: hospitalId! },
    include: {
      template: { select: { name: true, type: true, fields: true } },
    },
  })

  if (!submission) {
    return NextResponse.json({ error: "Form submission not found" }, { status: 404 })
  }

  // Get patient info if linked
  let patientName = "Unknown Patient"
  let patientPhone = ""
  let patientDob = ""
  let patientDisplayId = ""
  if (submission.patientId) {
    const patient = await prisma.patient.findUnique({
      where: { id: submission.patientId },
      select: { firstName: true, lastName: true, phone: true, dateOfBirth: true, patientId: true },
    })
    if (patient) {
      patientName = `${patient.firstName} ${patient.lastName}`
      patientPhone = patient.phone || ""
      patientDob = patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : ""
      patientDisplayId = patient.patientId || ""
    }
  }

  // Get clinic info
  const clinicInfo = await prisma.hospital.findUnique({ where: { id: hospitalId! }, select: { name: true, address: true, phone: true, email: true } })

  // Parse form fields and submission data
  let templateFields: Array<{ label: string; type: string }> = []
  try {
    templateFields = typeof submission.template.fields === "string"
      ? JSON.parse(submission.template.fields)
      : (submission.template.fields as any[]) || []
  } catch { /* empty */ }

  let submittedData: Record<string, unknown> = {}
  try {
    submittedData = typeof submission.data === "string"
      ? JSON.parse(submission.data)
      : (submission.data as Record<string, unknown>) || {}
  } catch { /* empty */ }

  // Build fields array for PDF
  const fields = templateFields.map((field) => ({
    label: field.label || "Field",
    value: String(submittedData[field.label] ?? submittedData[field.label?.toLowerCase()] ?? "N/A"),
    type: field.type,
  }))

  const html = generateFormPdfHtml({
    clinicName: clinicInfo?.name || "Dental Clinic",
    clinicAddress: clinicInfo?.address || undefined,
    clinicPhone: clinicInfo?.phone || undefined,
    clinicEmail: clinicInfo?.email || undefined,
    patientName,
    patientId: patientDisplayId,
    patientPhone,
    patientDob,
    formTitle: submission.template.name,
    formType: submission.template.type,
    submittedAt: submission.createdAt.toISOString(),
    fields,
    signature: submission.signature || undefined,
    signedAt: submission.signedAt?.toISOString() || undefined,
  })

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="${submission.template.name.replace(/\s+/g, "-")}-${patientName.replace(/\s+/g, "-")}.html"`,
    },
  })
}
