import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// PUT - Update referral (mark converted, give reward, etc.)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    if (!["ADMIN", "RECEPTIONIST"].includes(session.user.role)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const existing = await prisma.referral.findUnique({ where: { id } })
    if (!existing || existing.hospitalId !== hospitalId) {
      return NextResponse.json({ error: "Referral not found" }, { status: 404 })
    }

    const updateData: any = {}

    if (body.status) {
      updateData.status = body.status
      if (body.status === "CONVERTED") {
        updateData.convertedAt = new Date()
      }
      if (body.status === "REWARDED") {
        updateData.rewardGiven = true
        updateData.rewardGivenAt = new Date()
      }
    }

    if (body.referredPatientId !== undefined) updateData.referredPatientId = body.referredPatientId
    if (body.rewardType !== undefined) updateData.rewardType = body.rewardType
    if (body.rewardValue !== undefined) updateData.rewardValue = body.rewardValue

    const referral = await prisma.referral.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(referral)
  } catch (err) {
    console.error("Error updating referral:", err)
    return NextResponse.json({ error: "Failed to update referral" }, { status: 500 })
  }
}
