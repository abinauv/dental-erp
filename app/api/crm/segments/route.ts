import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// GET - Get patient segments based on criteria
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const now = new Date()
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

    // Get all active patients with their last appointment
    const patients = await prisma.patient.findMany({
      where: { hospitalId, isActive: true },
      select: {
        id: true,
        patientId: true,
        firstName: true,
        lastName: true,
        phone: true,
        createdAt: true,
        appointments: {
          select: { scheduledDate: true, status: true },
          orderBy: { scheduledDate: "desc" },
          take: 1,
        },
        invoices: {
          select: { totalAmount: true },
          where: { status: { not: "CANCELLED" } },
        },
      },
    })

    // Segment patients
    const segments: Record<string, any[]> = {
      new: [],       // Registered in last 3 months, <=1 visit
      active: [],    // Visited in last 3 months
      loyal: [],     // 4+ visits in last year AND visited in last 6 months
      atRisk: [],    // Last visit 3-6 months ago
      lost: [],      // No visit in 6+ months
      highValue: [], // Total spend > top 20%
    }

    // Calculate total spend per patient for high-value threshold
    const spendMap = patients.map((p: any) => {
      const totalSpend = (p.invoices || []).reduce(
        (sum: number, inv: any) => sum + Number(inv.totalAmount || 0), 0
      )
      return { ...p, totalSpend }
    })

    const sortedBySpend = [...spendMap].sort((a, b) => b.totalSpend - a.totalSpend)
    const highValueThreshold = sortedBySpend.length > 0
      ? sortedBySpend[Math.floor(sortedBySpend.length * 0.2)]?.totalSpend || 0
      : 0

    for (const patient of spendMap) {
      const lastVisit = patient.appointments[0]?.scheduledDate
        ? new Date(patient.appointments[0].scheduledDate)
        : null

      const patientInfo = {
        id: patient.id,
        patientId: patient.patientId,
        firstName: patient.firstName,
        lastName: patient.lastName,
        phone: patient.phone,
        lastVisit: lastVisit?.toISOString() || null,
        totalSpend: patient.totalSpend,
      }

      // High value (can overlap with other segments)
      if (patient.totalSpend >= highValueThreshold && highValueThreshold > 0) {
        segments.highValue.push(patientInfo)
      }

      // New patient
      if (new Date(patient.createdAt) > threeMonthsAgo) {
        segments.new.push(patientInfo)
        continue
      }

      if (!lastVisit) {
        segments.lost.push(patientInfo)
        continue
      }

      if (lastVisit > threeMonthsAgo) {
        segments.active.push(patientInfo)
      } else if (lastVisit > sixMonthsAgo) {
        segments.atRisk.push(patientInfo)
      } else {
        segments.lost.push(patientInfo)
      }
    }

    return NextResponse.json({
      segments: {
        new: { count: segments.new.length, patients: segments.new },
        active: { count: segments.active.length, patients: segments.active },
        loyal: { count: segments.loyal.length, patients: segments.loyal },
        atRisk: { count: segments.atRisk.length, patients: segments.atRisk },
        lost: { count: segments.lost.length, patients: segments.lost },
        highValue: { count: segments.highValue.length, patients: segments.highValue },
      },
      totalPatients: patients.length,
    })
  } catch (err) {
    console.error("Error fetching segments:", err)
    return NextResponse.json({ error: "Failed to fetch segments" }, { status: 500 })
  }
}
