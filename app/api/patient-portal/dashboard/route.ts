import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePatientAuth } from "@/lib/patient-auth"

/**
 * GET: Patient dashboard data — upcoming appointments, recent treatments, outstanding balance.
 */
export async function GET(req: NextRequest) {
  const { error, patient } = await requirePatientAuth(req)
  if (error) return error

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [upcomingAppointments, recentTreatments, outstandingInvoices, totalVisits] =
      await Promise.all([
        // Upcoming appointments
        prisma.appointment.findMany({
          where: {
            patientId: patient!.id,
            hospitalId: patient!.hospitalId,
            scheduledDate: { gte: today },
            status: { in: ["SCHEDULED", "CONFIRMED"] },
          },
          include: {
            doctor: {
              select: { firstName: true, lastName: true, specialization: true },
            },
          },
          orderBy: { scheduledDate: "asc" },
          take: 5,
        }),

        // Recent treatments
        prisma.treatment.findMany({
          where: {
            patientId: patient!.id,
            hospitalId: patient!.hospitalId,
          },
          include: {
            procedure: { select: { name: true, code: true } },
            doctor: { select: { firstName: true, lastName: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),

        // Outstanding invoices
        prisma.invoice.findMany({
          where: {
            patientId: patient!.id,
            hospitalId: patient!.hospitalId,
            status: { in: ["PENDING", "PARTIALLY_PAID"] },
          },
          select: {
            id: true,
            invoiceNo: true,
            totalAmount: true,
            paidAmount: true,
            balanceAmount: true,
            status: true,
            dueDate: true,
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),

        // Total visits
        prisma.appointment.count({
          where: {
            patientId: patient!.id,
            hospitalId: patient!.hospitalId,
            status: "COMPLETED",
          },
        }),
      ])

    const totalOutstanding = outstandingInvoices.reduce(
      (sum, inv) => sum + Number(inv.balanceAmount),
      0
    )

    return NextResponse.json({
      upcomingAppointments,
      recentTreatments,
      outstandingInvoices,
      stats: {
        totalVisits,
        upcomingCount: upcomingAppointments.length,
        totalOutstanding,
        outstandingCount: outstandingInvoices.length,
      },
    })
  } catch (err: unknown) {
    console.error("Patient dashboard error:", err)
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    )
  }
}
