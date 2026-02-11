import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { generateClaimNo } from "@/lib/billing-utils"
import { InsuranceClaimStatus } from "@prisma/client"

// GET - List insurance claims with filters
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || ""
    const patientId = searchParams.get("patientId") || ""
    const provider = searchParams.get("provider") || ""
    const dateFrom = searchParams.get("dateFrom") || ""
    const dateTo = searchParams.get("dateTo") || ""

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = { hospitalId }

    if (search) {
      where.OR = [
        { claimNumber: { contains: search } },
        { policyNumber: { contains: search } },
        { insuranceProvider: { contains: search } },
        { patient: { firstName: { contains: search } } },
        { patient: { lastName: { contains: search } } },
        { patient: { patientId: { contains: search } } },
      ]
    }

    if (status) {
      where.status = status
    }

    if (patientId) {
      where.patientId = patientId
    }

    if (provider) {
      where.insuranceProvider = { contains: provider }
    }

    if (dateFrom || dateTo) {
      where.submittedDate = {}
      if (dateFrom) {
        where.submittedDate.gte = new Date(dateFrom)
      }
      if (dateTo) {
        const endDate = new Date(dateTo)
        endDate.setHours(23, 59, 59, 999)
        where.submittedDate.lte = endDate
      }
    }

    const [claims, total] = await Promise.all([
      prisma.insuranceClaim.findMany({
        where,
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
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit,
      }),
      prisma.insuranceClaim.count({ where })
    ])

    // Calculate summary stats
    const [totalClaimed, totalApproved, totalSettled] = await Promise.all([
      prisma.insuranceClaim.aggregate({
        where: { hospitalId, status: { not: "DRAFT" } },
        _sum: { claimAmount: true }
      }),
      prisma.insuranceClaim.aggregate({
        where: { hospitalId, status: { in: ["APPROVED", "PARTIALLY_APPROVED", "SETTLED"] } },
        _sum: { approvedAmount: true }
      }),
      prisma.insuranceClaim.aggregate({
        where: { hospitalId, status: "SETTLED" },
        _sum: { settledAmount: true }
      })
    ])

    return NextResponse.json({
      claims,
      summary: {
        totalClaimed: totalClaimed._sum.claimAmount || 0,
        totalApproved: totalApproved._sum.approvedAmount || 0,
        totalSettled: totalSettled._sum.settledAmount || 0,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("Error fetching insurance claims:", error)
    return NextResponse.json(
      { error: "Failed to fetch insurance claims" },
      { status: 500 }
    )
  }
}

// POST - Create new insurance claim
export async function POST(request: NextRequest) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Check if user has permission
    if (!["ADMIN", "ACCOUNTANT"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You don't have permission to create insurance claims" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      patientId,
      insuranceProvider,
      policyNumber,
      claimAmount,
      invoiceIds = [],
      notes,
      documents,
    } = body

    // Validate required fields
    if (!patientId) {
      return NextResponse.json(
        { error: "Patient is required" },
        { status: 400 }
      )
    }

    if (!insuranceProvider) {
      return NextResponse.json(
        { error: "Insurance provider is required" },
        { status: 400 }
      )
    }

    if (!policyNumber) {
      return NextResponse.json(
        { error: "Policy number is required" },
        { status: 400 }
      )
    }

    if (!claimAmount || claimAmount <= 0) {
      return NextResponse.json(
        { error: "Valid claim amount is required" },
        { status: 400 }
      )
    }

    // Check if patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId, hospitalId }
    })
    if (!patient) {
      return NextResponse.json(
        { error: "Patient not found" },
        { status: 404 }
      )
    }

    // Validate invoices if provided
    if (invoiceIds.length > 0) {
      const invoices = await prisma.invoice.findMany({
        where: {
          id: { in: invoiceIds },
          patientId: patientId,
          hospitalId
        }
      })

      if (invoices.length !== invoiceIds.length) {
        return NextResponse.json(
          { error: "One or more invoices not found or don't belong to this patient" },
          { status: 400 }
        )
      }
    }

    // Generate claim number
    const claimNumber = await generateClaimNo(prisma)

    // Create insurance claim
    const claim = await prisma.insuranceClaim.create({
      data: {
        hospitalId,
        claimNumber,
        patientId,
        insuranceProvider,
        policyNumber,
        claimAmount,
        status: "DRAFT",
        notes,
        documents,
      }
    })

    // Link invoices to claim if provided
    if (invoiceIds.length > 0) {
      await prisma.invoice.updateMany({
        where: { id: { in: invoiceIds }, hospitalId },
        data: { insuranceClaimId: claim.id }
      })
    }

    // Fetch the claim with patient relation for response
    const fullClaim = await prisma.insuranceClaim.findUnique({
      where: { id: claim.id },
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
      }
    })

    return NextResponse.json(fullClaim, { status: 201 })
  } catch (error) {
    console.error("Error creating insurance claim:", error)
    return NextResponse.json(
      { error: "Failed to create insurance claim" },
      { status: 500 }
    )
  }
}
