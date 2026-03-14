import { NextResponse } from "next/server"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

/**
 * GET /api/forms/[id]/verify
 * Verify the authenticity of a signed form submission.
 * Checks: signature exists, computes hash of submission data + signature,
 * returns verification status with audit trail info.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN", "DOCTOR"])
  if (error) return error

  const { id } = await params

  const submission = await prisma.formSubmission.findFirst({
    where: { id, hospitalId: hospitalId! },
    include: {
      template: { select: { name: true, type: true } },
    },
  })

  if (!submission) {
    return NextResponse.json({ error: "Form submission not found" }, { status: 404 })
  }

  // Verify signature existence
  const hasSignature = !!submission.signature
  const signedAt = submission.signedAt
  const ipAddress = submission.ipAddress

  // Compute integrity hash from submission data + signature
  const dataStr = typeof submission.data === "string" ? submission.data : JSON.stringify(submission.data)
  const hashInput = `${dataStr}|${submission.signature || ""}|${submission.signedAt?.toISOString() || ""}`
  const integrityHash = crypto.createHash("sha256").update(hashInput).digest("hex")

  // Get patient info for audit trail
  let patientName = "Unknown"
  if (submission.patientId) {
    const patient = await prisma.patient.findUnique({
      where: { id: submission.patientId },
      select: { firstName: true, lastName: true },
    })
    if (patient) patientName = `${patient.firstName} ${patient.lastName}`
  }

  // Get reviewer info
  let reviewerName = null
  if (submission.reviewedBy) {
    const reviewer = await prisma.user.findUnique({
      where: { id: submission.reviewedBy },
      select: { name: true },
    })
    reviewerName = reviewer?.name || null
  }

  return NextResponse.json({
    verified: hasSignature && !!signedAt,
    formId: submission.id,
    formType: submission.template.type,
    formName: submission.template.name,
    auditTrail: {
      patientName,
      signedAt: signedAt?.toISOString() || null,
      ipAddress: ipAddress || null,
      hasSignature,
      integrityHash,
      submittedAt: submission.createdAt.toISOString(),
      status: submission.status,
      reviewedBy: reviewerName,
      reviewedAt: submission.reviewedAt?.toISOString() || null,
    },
  })
}
