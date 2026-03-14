import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// GET - Get loyalty points for a patient or all transactions
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get("patientId") || ""
    const type = searchParams.get("type") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")

    const where: any = { hospitalId }
    if (patientId) where.patientId = patientId
    if (type) where.type = type

    const [transactions, total] = await Promise.all([
      prisma.loyaltyTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.loyaltyTransaction.count({ where }),
    ])

    // Calculate total points for the patient
    let balance = 0
    if (patientId) {
      const result = await prisma.loyaltyTransaction.aggregate({
        where: { hospitalId, patientId },
        _sum: { points: true },
      })
      balance = result._sum.points || 0
    }

    return NextResponse.json({
      transactions,
      balance,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error("Error fetching loyalty transactions:", err)
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 })
  }
}

// POST - Award or redeem loyalty points
export async function POST(request: NextRequest) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    if (!["ADMIN", "RECEPTIONIST", "ACCOUNTANT"].includes(session.user.role)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }

    const body = await request.json()
    const { patientId, points, type, description, referenceId } = body

    if (!patientId || points === undefined || !type || !description) {
      return NextResponse.json(
        { error: "patientId, points, type, and description are required" },
        { status: 400 }
      )
    }

    // Validate patient
    const patient = await prisma.patient.findUnique({
      where: { id: patientId, hospitalId },
    })
    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    }

    // For redemptions, check balance
    if (points < 0) {
      const result = await prisma.loyaltyTransaction.aggregate({
        where: { hospitalId, patientId },
        _sum: { points: true },
      })
      const balance = result._sum.points || 0
      if (balance + points < 0) {
        return NextResponse.json(
          { error: `Insufficient points. Balance: ${balance}` },
          { status: 400 }
        )
      }
    }

    const transaction = await prisma.loyaltyTransaction.create({
      data: {
        hospitalId,
        patientId,
        points,
        type,
        description,
        referenceId: referenceId || null,
      },
    })

    return NextResponse.json(transaction, { status: 201 })
  } catch (err) {
    console.error("Error creating loyalty transaction:", err)
    return NextResponse.json({ error: "Failed to process transaction" }, { status: 500 })
  }
}
