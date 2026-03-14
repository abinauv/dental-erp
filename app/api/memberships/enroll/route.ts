import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// POST - Enroll patient in membership plan
export async function POST(request: NextRequest) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    if (!["ADMIN", "RECEPTIONIST", "ACCOUNTANT"].includes(session.user.role)) {
      return NextResponse.json({ error: "Not authorized to enroll patients" }, { status: 403 })
    }

    const body = await request.json()
    const { patientId, planId, autoRenew } = body

    if (!patientId || !planId) {
      return NextResponse.json({ error: "Patient and plan are required" }, { status: 400 })
    }

    // Verify patient
    const patient = await prisma.patient.findUnique({
      where: { id: patientId, hospitalId },
    })
    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    }

    // Verify plan
    const plan = await prisma.membershipPlan.findUnique({
      where: { id: planId },
    })
    if (!plan || plan.hospitalId !== hospitalId || !plan.isActive) {
      return NextResponse.json({ error: "Plan not found or inactive" }, { status: 404 })
    }

    // Check for existing active membership
    const existing = await prisma.patientMembership.findFirst({
      where: { patientId, hospitalId, status: "ACTIVE" },
    })
    if (existing) {
      return NextResponse.json(
        { error: "Patient already has an active membership" },
        { status: 409 }
      )
    }

    const startDate = new Date()
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + plan.duration)

    const membership = await prisma.patientMembership.create({
      data: {
        hospitalId,
        patientId,
        planId,
        startDate,
        endDate,
        autoRenew: autoRenew || false,
      },
      include: {
        plan: { select: { name: true, price: true, duration: true } },
        patient: { select: { firstName: true, lastName: true, patientId: true } },
      },
    })

    return NextResponse.json(membership, { status: 201 })
  } catch (err) {
    console.error("Error enrolling patient:", err)
    return NextResponse.json({ error: "Failed to enroll patient" }, { status: 500 })
  }
}

// GET - List memberships with filters
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || ""
    const patientId = searchParams.get("patientId") || ""
    const planId = searchParams.get("planId") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")

    const where: any = { hospitalId }
    if (status) where.status = status
    if (patientId) where.patientId = patientId
    if (planId) where.planId = planId

    const [memberships, total] = await Promise.all([
      prisma.patientMembership.findMany({
        where,
        include: {
          plan: { select: { name: true, price: true, duration: true } },
          patient: { select: { id: true, patientId: true, firstName: true, lastName: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.patientMembership.count({ where }),
    ])

    return NextResponse.json({
      memberships,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error("Error fetching memberships:", err)
    return NextResponse.json({ error: "Failed to fetch memberships" }, { status: 500 })
  }
}
