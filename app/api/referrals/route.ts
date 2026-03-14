import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = "REF-"
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// GET - List referrals
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || ""
    const search = searchParams.get("search") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")

    const where: any = { hospitalId }
    if (status) where.status = status
    if (search) {
      where.OR = [
        { referredName: { contains: search } },
        { referredPhone: { contains: search } },
        { referralCode: { contains: search } },
      ]
    }

    const [referrals, total] = await Promise.all([
      prisma.referral.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.referral.count({ where }),
    ])

    // Fetch referrer patient names
    const referrerIds = [...new Set(referrals.map((r) => r.referrerPatientId))]
    const referrers = await prisma.patient.findMany({
      where: { id: { in: referrerIds } },
      select: { id: true, firstName: true, lastName: true, patientId: true },
    })
    const referrerMap = Object.fromEntries(referrers.map((p) => [p.id, p]))

    const enriched = referrals.map((r) => ({
      ...r,
      referrerPatient: referrerMap[r.referrerPatientId] || null,
    }))

    // Summary stats
    const [totalReferrals, converted, rewarded] = await Promise.all([
      prisma.referral.count({ where: { hospitalId } }),
      prisma.referral.count({ where: { hospitalId, status: "CONVERTED" } }),
      prisma.referral.count({ where: { hospitalId, status: "REWARDED" } }),
    ])

    return NextResponse.json({
      referrals: enriched,
      summary: {
        total: totalReferrals,
        converted,
        rewarded,
        conversionRate: totalReferrals > 0 ? ((converted + rewarded) / totalReferrals * 100).toFixed(1) : "0",
      },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error("Error fetching referrals:", err)
    return NextResponse.json({ error: "Failed to fetch referrals" }, { status: 500 })
  }
}

// POST - Create referral
export async function POST(request: NextRequest) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    if (!["ADMIN", "RECEPTIONIST"].includes(session.user.role)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }

    const body = await request.json()
    const { referrerPatientId, referredName, referredPhone, rewardType, rewardValue } = body

    if (!referrerPatientId || !referredName?.trim() || !referredPhone?.trim()) {
      return NextResponse.json(
        { error: "Referrer patient, referred name, and phone are required" },
        { status: 400 }
      )
    }

    // Verify referrer patient
    const referrer = await prisma.patient.findUnique({
      where: { id: referrerPatientId, hospitalId },
    })
    if (!referrer) {
      return NextResponse.json({ error: "Referrer patient not found" }, { status: 404 })
    }

    // Generate unique code
    let referralCode = generateReferralCode()
    let attempts = 0
    while (attempts < 5) {
      const existing = await prisma.referral.findUnique({ where: { referralCode } })
      if (!existing) break
      referralCode = generateReferralCode()
      attempts++
    }

    const referral = await prisma.referral.create({
      data: {
        hospitalId,
        referrerPatientId,
        referredName: referredName.trim(),
        referredPhone: referredPhone.trim(),
        referralCode,
        rewardType: rewardType || "POINTS",
        rewardValue: rewardValue || null,
      },
    })

    return NextResponse.json(referral, { status: 201 })
  } catch (err) {
    console.error("Error creating referral:", err)
    return NextResponse.json({ error: "Failed to create referral" }, { status: 500 })
  }
}
