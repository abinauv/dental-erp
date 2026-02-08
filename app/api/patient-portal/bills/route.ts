import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePatientAuth } from "@/lib/patient-auth"

/**
 * GET: Patient's invoices with payment history.
 */
export async function GET(req: NextRequest) {
  const { error, patient } = await requirePatientAuth(req)
  if (error) return error

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status") || "" // all | PENDING | PAID etc.
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {
      patientId: patient!.id,
      hospitalId: patient!.hospitalId,
    }

    if (status && status !== "all") {
      where.status = status
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where: where as any,
        include: {
          items: {
            select: {
              description: true,
              quantity: true,
              unitPrice: true,
              amount: true,
            },
          },
          payments: {
            select: {
              id: true,
              paymentNo: true,
              amount: true,
              paymentMethod: true,
              paymentDate: true,
              status: true,
            },
            orderBy: { paymentDate: "desc" },
          },
          paymentLinks: {
            where: {
              usedAt: null,
              expiresAt: { gt: new Date() },
            },
            select: { token: true, amount: true, expiresAt: true },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.invoice.count({ where: where as any }),
    ])

    return NextResponse.json({
      invoices,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (err: unknown) {
    console.error("Patient bills error:", err)
    return NextResponse.json(
      { error: "Failed to load bills" },
      { status: 500 }
    )
  }
}
