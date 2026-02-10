import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// GET - CRM dashboard stats
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const now = new Date()
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const [
      activeMemberships,
      totalMemberships,
      membershipRevenue,
      totalReferrals,
      convertedReferrals,
      rewardedReferrals,
      loyaltyPointsCirculation,
      totalActivePatients,
      recentVisitors,
    ] = await Promise.all([
      prisma.patientMembership.count({ where: { hospitalId, status: "ACTIVE" } }),
      prisma.patientMembership.count({ where: { hospitalId } }),
      prisma.patientMembership.findMany({
        where: { hospitalId, status: "ACTIVE" },
        include: { plan: { select: { price: true } } },
      }),
      prisma.referral.count({ where: { hospitalId } }),
      prisma.referral.count({ where: { hospitalId, status: { in: ["CONVERTED", "REWARDED"] } } }),
      prisma.referral.count({ where: { hospitalId, status: "REWARDED" } }),
      prisma.loyaltyTransaction.aggregate({
        where: { hospitalId },
        _sum: { points: true },
      }),
      prisma.patient.count({ where: { hospitalId, isActive: true } }),
      prisma.patient.count({
        where: {
          hospitalId,
          isActive: true,
          appointments: { some: { scheduledDate: { gte: sixMonthsAgo } } },
        },
      }),
    ])

    const totalMembershipRevenue = membershipRevenue.reduce(
      (sum, m) => sum + Number(m.plan.price || 0), 0
    )

    const retentionRate = totalActivePatients > 0
      ? ((recentVisitors / totalActivePatients) * 100).toFixed(1)
      : "0"

    const referralConversionRate = totalReferrals > 0
      ? ((convertedReferrals / totalReferrals) * 100).toFixed(1)
      : "0"

    return NextResponse.json({
      memberships: {
        active: activeMemberships,
        total: totalMemberships,
        revenue: totalMembershipRevenue,
      },
      referrals: {
        total: totalReferrals,
        converted: convertedReferrals,
        rewarded: rewardedReferrals,
        conversionRate: referralConversionRate,
      },
      loyalty: {
        pointsInCirculation: loyaltyPointsCirculation._sum.points || 0,
      },
      retention: {
        totalActive: totalActivePatients,
        recentVisitors,
        rate: retentionRate,
        atRisk: totalActivePatients - recentVisitors,
      },
    })
  } catch (err) {
    console.error("Error fetching CRM dashboard:", err)
    return NextResponse.json({ error: "Failed to fetch dashboard" }, { status: 500 })
  }
}
