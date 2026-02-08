import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { InsuranceClaimStatus } from "@prisma/client"

// GET - Get single insurance claim details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params

    const claim = await prisma.insuranceClaim.findUnique({
      where: { id, hospitalId },
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            address: true,
            city: true,
            state: true,
            pincode: true,
          }
        },
        invoices: {
          select: {
            id: true,
            invoiceNo: true,
            createdAt: true,
            totalAmount: true,
            insuranceAmount: true,
            status: true,
            items: {
              select: {
                id: true,
                description: true,
                quantity: true,
                unitPrice: true,
                amount: true,
              }
            }
          }
        }
      }
    })

    if (!claim) {
      return NextResponse.json(
        { error: "Insurance claim not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(claim)
  } catch (error) {
    console.error("Error fetching insurance claim:", error)
    return NextResponse.json(
      { error: "Failed to fetch insurance claim" },
      { status: 500 }
    )
  }
}

// PUT - Update insurance claim
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Check if user has permission
    if (!["ADMIN", "ACCOUNTANT"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You don't have permission to update insurance claims" },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()

    // Check if claim exists
    const existingClaim = await prisma.insuranceClaim.findUnique({
      where: { id, hospitalId }
    })

    if (!existingClaim) {
      return NextResponse.json(
        { error: "Insurance claim not found" },
        { status: 404 }
      )
    }

    const {
      insuranceProvider,
      policyNumber,
      claimAmount,
      approvedAmount,
      settledAmount,
      status,
      notes,
      documents,
      rejectionReason,
      denialCode,
      appealDeadline,
      appealStatus,
      appealDate,
      appealNotes,
    } = body

    let updateData: any = {}

    // Only allow editing certain fields based on current status
    if (existingClaim.status === "DRAFT" || existingClaim.status === "SUBMITTED") {
      if (insuranceProvider) updateData.insuranceProvider = insuranceProvider
      if (policyNumber) updateData.policyNumber = policyNumber
      if (claimAmount) updateData.claimAmount = claimAmount
    }

    // Always allow updating notes and documents
    if (notes !== undefined) updateData.notes = notes
    if (documents !== undefined) updateData.documents = documents

    // Denial / Appeal management fields — always updatable
    if (denialCode !== undefined) updateData.denialCode = denialCode
    if (appealDeadline !== undefined) updateData.appealDeadline = appealDeadline ? new Date(appealDeadline) : null
    if (appealStatus !== undefined) updateData.appealStatus = appealStatus
    if (appealDate !== undefined) updateData.appealDate = appealDate ? new Date(appealDate) : null
    if (appealNotes !== undefined) updateData.appealNotes = appealNotes

    // Handle status transitions
    if (status && status !== existingClaim.status) {
      const validTransitions: Record<InsuranceClaimStatus, InsuranceClaimStatus[]> = {
        DRAFT: ["SUBMITTED"],
        SUBMITTED: ["UNDER_REVIEW", "APPROVED", "PARTIALLY_APPROVED", "REJECTED"],
        UNDER_REVIEW: ["APPROVED", "PARTIALLY_APPROVED", "REJECTED"],
        APPROVED: ["SETTLED"],
        PARTIALLY_APPROVED: ["SETTLED"],
        REJECTED: [],
        SETTLED: [],
      }

      const allowedStatuses = validTransitions[existingClaim.status]
      if (!allowedStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${existingClaim.status} to ${status}` },
          { status: 400 }
        )
      }

      updateData.status = status

      // Set date fields based on status
      switch (status) {
        case "SUBMITTED":
          updateData.submissionDate = new Date()
          break
        case "APPROVED":
        case "PARTIALLY_APPROVED":
          updateData.approvalDate = new Date()
          if (approvedAmount !== undefined) {
            updateData.approvedAmount = approvedAmount
          }
          break
        case "REJECTED":
          updateData.rejectionDate = new Date()
          if (rejectionReason) {
            updateData.rejectionReason = rejectionReason
          }
          break
        case "SETTLED":
          updateData.settlementDate = new Date()
          if (settledAmount !== undefined) {
            updateData.settledAmount = settledAmount
          }
          // Record insurance payment on linked invoices
          break
      }
    }

    // Handle approval amount update
    if (approvedAmount !== undefined && ["APPROVED", "PARTIALLY_APPROVED"].includes(existingClaim.status)) {
      updateData.approvedAmount = approvedAmount
    }

    // Handle settlement amount update
    if (settledAmount !== undefined && existingClaim.status === "SETTLED") {
      updateData.settledAmount = settledAmount
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      )
    }

    const claim = await prisma.insuranceClaim.update({
      where: { id, hospitalId },
      data: updateData,
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            lastName: true,
            phone: true,
          }
        },
        invoices: {
          select: {
            id: true,
            invoiceNo: true,
            totalAmount: true,
            insuranceAmount: true,
          }
        }
      }
    })

    return NextResponse.json(claim)
  } catch (error) {
    console.error("Error updating insurance claim:", error)
    return NextResponse.json(
      { error: "Failed to update insurance claim" },
      { status: 500 }
    )
  }
}

// DELETE - Delete insurance claim (only drafts)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Check if user has permission
    if (!["ADMIN"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You don't have permission to delete insurance claims" },
        { status: 403 }
      )
    }

    const { id } = await params

    // Check if claim exists
    const existingClaim = await prisma.insuranceClaim.findUnique({
      where: { id, hospitalId }
    })

    if (!existingClaim) {
      return NextResponse.json(
        { error: "Insurance claim not found" },
        { status: 404 }
      )
    }

    // Only allow deleting drafts
    if (existingClaim.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Can only delete draft claims" },
        { status: 400 }
      )
    }

    // Unlink invoices first
    await prisma.invoice.updateMany({
      where: { insuranceClaimId: id, hospitalId },
      data: { insuranceClaimId: null }
    })

    // Delete the claim
    await prisma.insuranceClaim.delete({
      where: { id }
    })

    return NextResponse.json({ message: "Insurance claim deleted successfully" })
  } catch (error) {
    console.error("Error deleting insurance claim:", error)
    return NextResponse.json(
      { error: "Failed to delete insurance claim" },
      { status: 500 }
    )
  }
}
