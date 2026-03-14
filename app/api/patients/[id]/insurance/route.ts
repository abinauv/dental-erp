import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: patientId } = await params

  const policies = await prisma.patientInsurance.findMany({
    where: { hospitalId, patientId },
    include: {
      provider: { select: { id: true, name: true, code: true, contactPhone: true } },
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  })

  return NextResponse.json(policies)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN", "ACCOUNTANT", "RECEPTIONIST"])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: patientId } = await params

  try {
    const body = await req.json()
    const {
      providerId, policyNumber, groupNumber, memberId, subscriberName,
      subscriberRelation, effectiveDate, expiryDate, coverageType,
      annualMaximum, deductible, copayPercentage,
    } = body

    if (!providerId || !policyNumber || !memberId || !subscriberName || !effectiveDate) {
      return NextResponse.json(
        { error: "Provider, policy number, member ID, subscriber name, and effective date are required" },
        { status: 400 }
      )
    }

    const policy = await prisma.patientInsurance.create({
      data: {
        hospitalId,
        patientId,
        providerId,
        policyNumber: policyNumber.trim(),
        groupNumber: groupNumber?.trim() || null,
        memberId: memberId.trim(),
        subscriberName: subscriberName.trim(),
        subscriberRelation: subscriberRelation || "Self",
        effectiveDate: new Date(effectiveDate),
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        coverageType: coverageType || null,
        annualMaximum: annualMaximum ? parseFloat(annualMaximum) : null,
        usedAmount: 0,
        remainingAmount: annualMaximum ? parseFloat(annualMaximum) : null,
        deductible: deductible ? parseFloat(deductible) : null,
        copayPercentage: copayPercentage ? parseFloat(copayPercentage) : null,
      },
      include: {
        provider: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(policy, { status: 201 })
  } catch (err) {
    console.error("Create patient insurance error:", err)
    return NextResponse.json({ error: "Failed to create insurance policy" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN", "ACCOUNTANT"])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: patientId } = await params

  try {
    const body = await req.json()
    const { policyId, ...updateData } = body

    if (!policyId) {
      return NextResponse.json({ error: "Policy ID is required" }, { status: 400 })
    }

    const result = await prisma.patientInsurance.updateMany({
      where: { id: policyId, hospitalId, patientId },
      data: {
        ...(updateData.policyNumber !== undefined && { policyNumber: updateData.policyNumber.trim() }),
        ...(updateData.groupNumber !== undefined && { groupNumber: updateData.groupNumber?.trim() || null }),
        ...(updateData.memberId !== undefined && { memberId: updateData.memberId.trim() }),
        ...(updateData.subscriberName !== undefined && { subscriberName: updateData.subscriberName.trim() }),
        ...(updateData.subscriberRelation !== undefined && { subscriberRelation: updateData.subscriberRelation }),
        ...(updateData.effectiveDate !== undefined && { effectiveDate: new Date(updateData.effectiveDate) }),
        ...(updateData.expiryDate !== undefined && { expiryDate: updateData.expiryDate ? new Date(updateData.expiryDate) : null }),
        ...(updateData.coverageType !== undefined && { coverageType: updateData.coverageType || null }),
        ...(updateData.annualMaximum !== undefined && { annualMaximum: updateData.annualMaximum ? parseFloat(updateData.annualMaximum) : null }),
        ...(updateData.usedAmount !== undefined && { usedAmount: updateData.usedAmount ? parseFloat(updateData.usedAmount) : null }),
        ...(updateData.remainingAmount !== undefined && { remainingAmount: updateData.remainingAmount ? parseFloat(updateData.remainingAmount) : null }),
        ...(updateData.deductible !== undefined && { deductible: updateData.deductible ? parseFloat(updateData.deductible) : null }),
        ...(updateData.deductibleMet !== undefined && { deductibleMet: updateData.deductibleMet }),
        ...(updateData.copayPercentage !== undefined && { copayPercentage: updateData.copayPercentage ? parseFloat(updateData.copayPercentage) : null }),
        ...(updateData.isActive !== undefined && { isActive: updateData.isActive }),
      },
    })

    if (result.count === 0) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Update patient insurance error:", err)
    return NextResponse.json({ error: "Failed to update insurance policy" }, { status: 500 })
  }
}
