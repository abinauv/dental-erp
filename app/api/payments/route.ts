import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// GET - List all payments with filters
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
    const paymentMethod = searchParams.get("paymentMethod") || ""
    const dateFrom = searchParams.get("dateFrom") || ""
    const dateTo = searchParams.get("dateTo") || ""
    const invoiceId = searchParams.get("invoiceId") || ""

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = { hospitalId }

    if (search) {
      where.OR = [
        { paymentNo: { contains: search } },
        { transactionId: { contains: search } },
        { invoice: { invoiceNo: { contains: search } } },
        { invoice: { patient: { firstName: { contains: search } } } },
        { invoice: { patient: { lastName: { contains: search } } } },
        { invoice: { patient: { patientId: { contains: search } } } },
      ]
    }

    if (status) {
      where.status = status
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod
    }

    if (invoiceId) {
      where.invoiceId = invoiceId
    }

    if (dateFrom || dateTo) {
      where.paymentDate = {}
      if (dateFrom) {
        where.paymentDate.gte = new Date(dateFrom)
      }
      if (dateTo) {
        const endDate = new Date(dateTo)
        endDate.setHours(23, 59, 59, 999)
        where.paymentDate.lte = endDate
      }
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNo: true,
              totalAmount: true,
              patient: {
                select: {
                  id: true,
                  patientId: true,
                  firstName: true,
                  lastName: true,
                  phone: true,
                }
              }
            }
          }
        },
        orderBy: {
          paymentDate: 'desc'
        },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where })
    ])

    // Calculate summary stats
    const summaryWhere = { ...where }
    delete summaryWhere.OR // Remove search for summary

    const [totalReceived, totalRefunded] = await Promise.all([
      prisma.payment.aggregate({
        where: { ...summaryWhere, status: "COMPLETED" },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: { ...summaryWhere, status: "REFUNDED" },
        _sum: { refundAmount: true }
      })
    ])

    return NextResponse.json({
      payments,
      summary: {
        totalReceived: totalReceived._sum.amount || 0,
        totalRefunded: totalRefunded._sum.refundAmount || 0,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("Error fetching payments:", error)
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    )
  }
}
