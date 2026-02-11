import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { complete, extractJSON } from "@/lib/ai/openrouter"
import { getModelByTier } from "@/lib/ai/models"

/**
 * POST /api/ai/claim-analysis
 * Analyzes a denied insurance claim and suggests corrections + appeal letter.
 * Body: { claimId: string }
 */
export async function POST(req: Request) {
  try {
    const { error, session, hospitalId } = await requireAuthAndRole(["ADMIN", "ACCOUNTANT"])
    if (error || !hospitalId) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { claimId } = await req.json()
    if (!claimId) {
      return NextResponse.json({ error: "claimId is required" }, { status: 400 })
    }

    const claim = await prisma.insuranceClaim.findFirst({
      where: { id: claimId, hospitalId },
      include: {
        patient: {
          select: { firstName: true, lastName: true, patientId: true, dateOfBirth: true },
        },
        invoices: {
          select: { invoiceNo: true, totalAmount: true, items: true },
        },
      },
    })

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 })
    }

    // Gather denial history patterns for this hospital
    const denialHistory = await prisma.insuranceClaim.findMany({
      where: {
        hospitalId,
        status: { in: ["REJECTED", "PARTIALLY_APPROVED"] },
      },
      select: {
        denialCode: true,
        rejectionReason: true,
        insuranceProvider: true,
      },
      take: 50,
      orderBy: { createdAt: "desc" },
    })

    // Common denial codes in this hospital
    const denialCodeCounts: Record<string, number> = {}
    for (const d of denialHistory) {
      if (d.denialCode) {
        denialCodeCounts[d.denialCode] = (denialCodeCounts[d.denialCode] || 0) + 1
      }
    }

    const contextData = {
      claim: {
        claimNumber: claim.claimNumber,
        insuranceProvider: claim.insuranceProvider,
        policyNumber: claim.policyNumber,
        claimAmount: Number(claim.claimAmount),
        approvedAmount: claim.approvedAmount ? Number(claim.approvedAmount) : null,
        status: claim.status,
        submissionDate: claim.submittedDate?.toISOString().split("T")[0],
        rejectionReason: claim.rejectionReason,
        denialCode: claim.denialCode,
        appealStatus: claim.appealStatus,
        appealNotes: claim.appealNotes,
      },
      patient: {
        name: `${claim.patient.firstName} ${claim.patient.lastName}`,
        patientId: claim.patient.patientId,
        dateOfBirth: claim.patient.dateOfBirth?.toISOString().split("T")[0],
      },
      invoices: claim.invoices.map((inv) => ({
        invoiceNo: inv.invoiceNo,
        totalAmount: Number(inv.totalAmount),
      })),
      hospitalDenialPatterns: {
        commonDenialCodes: denialCodeCounts,
        totalDenials: denialHistory.length,
        topProviderDenials: denialHistory.reduce((acc, d) => {
          acc[d.insuranceProvider] = (acc[d.insuranceProvider] || 0) + 1
          return acc
        }, {} as Record<string, number>),
      },
    }

    const model = getModelByTier("billing")
    const response = await complete(
      [
        {
          role: "system",
          content: `You are an insurance claim analysis AI for a dental clinic. Analyze the denied claim and provide actionable recovery suggestions.
Return JSON: { analysis: { likelyCause, denialCategory, severityOfDenial }, suggestions: [{ action, priority }], appealLetter: string|null, preventionTips: string[] }.
denialCategory: CODING/DOCUMENTATION/ELIGIBILITY/MEDICAL_NECESSITY/TIMELY_FILING/DUPLICATE/OTHER.
severityOfDenial: RECOVERABLE/PARTIAL/UNLIKELY.
Return ONLY valid JSON, no markdown.`,
        },
        {
          role: "user",
          content: `Analyze this denied insurance claim:\n${JSON.stringify(contextData, null, 2)}`,
        },
      ],
      model
    )

    let result: any
    try {
      const raw = extractJSON(response.content)
      result = JSON.parse(raw)
    } catch {
      result = {
        analysis: {
          likelyCause: "Unable to determine — please review the rejection reason manually",
          denialCategory: "OTHER",
          severityOfDenial: "PARTIAL",
        },
        suggestions: [
          { action: "Review the rejection reason and denial code", priority: "HIGH" },
          { action: "Gather supporting documentation", priority: "HIGH" },
          { action: "Contact the insurance provider for clarification", priority: "MEDIUM" },
        ],
        appealLetter: null,
        preventionTips: ["Verify patient eligibility before treatment", "Submit claims within the filing deadline"],
      }
    }

    // Log AI skill execution
    await prisma.aISkillExecution.create({
      data: {
        hospitalId,
        userId: session!.user.id,
        skill: "claim-analyzer",
        input: { claimId },
        output: result,
        tokensUsed: response.usage.totalTokens,
      },
    })

    return NextResponse.json({ ...result, claimId, model: response.model })
  } catch (error: any) {
    console.error("Claim analysis error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to analyze claim" },
      { status: error.message?.includes("Unauthorized") ? 401 : 500 }
    )
  }
}
