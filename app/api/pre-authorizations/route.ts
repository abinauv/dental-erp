import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

export async function GET(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN", "ACCOUNTANT"])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "10")
  const status = searchParams.get("status") || ""
  const search = searchParams.get("search")?.trim() || ""
  const patientId = searchParams.get("patientId") || ""

  const where: any = { hospitalId }
  if (status) where.status = status
  if (patientId) where.patientId = patientId
  if (search) {
    where.OR = [
      { authNumber: { contains: search } },
      { patient: { firstName: { contains: search } } },
      { patient: { lastName: { contains: search } } },
    ]
  }

  const [preAuths, total] = await Promise.all([
    prisma.preAuthorization.findMany({
      where,
      include: {
        patient: { select: { id: true, patientId: true, firstName: true, lastName: true } },
        policy: {
          select: {
            id: true,
            policyNumber: true,
            provider: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.preAuthorization.count({ where }),
  ])

  return NextResponse.json({
    preAuths,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}

export async function POST(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN", "ACCOUNTANT"])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const {
      patientId, insurancePolicyId, treatmentPlanId,
      procedures, estimatedCost, notes,
    } = body

    if (!patientId || !insurancePolicyId || !procedures || !estimatedCost) {
      return NextResponse.json(
        { error: "Patient, insurance policy, procedures, and estimated cost are required" },
        { status: 400 }
      )
    }

    // Verify policy belongs to patient and hospital
    const policy = await prisma.patientInsurance.findFirst({
      where: { id: insurancePolicyId, patientId, hospitalId, isActive: true },
    })

    if (!policy) {
      return NextResponse.json({ error: "Insurance policy not found" }, { status: 404 })
    }

    const preAuth = await prisma.preAuthorization.create({
      data: {
        hospitalId,
        patientId,
        insurancePolicyId,
        treatmentPlanId: treatmentPlanId || null,
        procedures,
        estimatedCost: parseFloat(estimatedCost),
        notes: notes?.trim() || null,
      },
      include: {
        patient: { select: { id: true, patientId: true, firstName: true, lastName: true } },
        policy: {
          select: {
            policyNumber: true,
            provider: { select: { name: true } },
          },
        },
      },
    })

    return NextResponse.json(preAuth, { status: 201 })
  } catch (err) {
    console.error("Create pre-authorization error:", err)
    return NextResponse.json({ error: "Failed to create pre-authorization" }, { status: 500 })
  }
}
