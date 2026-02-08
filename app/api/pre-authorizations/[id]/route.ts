import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN", "ACCOUNTANT"])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const preAuth = await prisma.preAuthorization.findFirst({
    where: { id, hospitalId },
    include: {
      patient: { select: { id: true, patientId: true, firstName: true, lastName: true, phone: true } },
      policy: {
        select: {
          id: true,
          policyNumber: true,
          memberId: true,
          subscriberName: true,
          annualMaximum: true,
          remainingAmount: true,
          provider: { select: { id: true, name: true, contactPhone: true } },
        },
      },
    },
  })

  if (!preAuth) {
    return NextResponse.json({ error: "Pre-authorization not found" }, { status: 404 })
  }

  return NextResponse.json(preAuth)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN", "ACCOUNTANT"])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const body = await req.json()
    const {
      status, authNumber, approvedAmount, approvedDate,
      expiryDate, denialReason, notes, procedures, estimatedCost,
    } = body

    const updateData: any = {}
    if (status !== undefined) updateData.status = status
    if (authNumber !== undefined) updateData.authNumber = authNumber?.trim() || null
    if (approvedAmount !== undefined) updateData.approvedAmount = approvedAmount ? parseFloat(approvedAmount) : null
    if (approvedDate !== undefined) updateData.approvedDate = approvedDate ? new Date(approvedDate) : null
    if (expiryDate !== undefined) updateData.expiryDate = expiryDate ? new Date(expiryDate) : null
    if (denialReason !== undefined) updateData.denialReason = denialReason?.trim() || null
    if (notes !== undefined) updateData.notes = notes?.trim() || null
    if (procedures !== undefined) updateData.procedures = procedures
    if (estimatedCost !== undefined) updateData.estimatedCost = parseFloat(estimatedCost)

    const result = await prisma.preAuthorization.updateMany({
      where: { id, hospitalId },
      data: updateData,
    })

    if (result.count === 0) {
      return NextResponse.json({ error: "Pre-authorization not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Update pre-authorization error:", err)
    return NextResponse.json({ error: "Failed to update pre-authorization" }, { status: 500 })
  }
}
