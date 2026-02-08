import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { generateInvoiceNo, calculateInvoiceTotals, gstConfig } from "@/lib/billing-utils"
import { DiscountType, InvoiceStatus } from "@prisma/client"

// GET - List invoices with filters
export async function GET(request: NextRequest) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || ""
    const patientId = searchParams.get("patientId") || ""
    const dateFrom = searchParams.get("dateFrom") || ""
    const dateTo = searchParams.get("dateTo") || ""
    const paymentMethod = searchParams.get("paymentMethod") || ""
    const overdue = searchParams.get("overdue") === "true"

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = { hospitalId }

    if (search) {
      where.OR = [
        { invoiceNo: { contains: search } },
        { patient: { firstName: { contains: search } } },
        { patient: { lastName: { contains: search } } },
        { patient: { patientId: { contains: search } } },
        { patient: { phone: { contains: search } } },
      ]
    }

    if (status) {
      where.status = status
    }

    if (patientId) {
      where.patientId = patientId
    }

    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom)
      }
      if (dateTo) {
        const endDate = new Date(dateTo)
        endDate.setHours(23, 59, 59, 999)
        where.createdAt.lte = endDate
      }
    }

    if (overdue) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      where.dueDate = { lt: today }
      where.status = { in: ["PENDING", "PARTIALLY_PAID"] }
    }

    // If filtering by payment method, we need to join with payments
    if (paymentMethod) {
      where.payments = {
        some: {
          paymentMethod: paymentMethod
        }
      }
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          patient: {
            select: {
              id: true,
              patientId: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
            }
          },
          items: {
            include: {
              treatment: {
                select: {
                  id: true,
                  treatmentNo: true,
                  procedure: {
                    select: {
                      name: true,
                      code: true
                    }
                  }
                }
              }
            }
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
            orderBy: {
              paymentDate: 'desc'
            }
          },
          insuranceClaim: {
            select: {
              id: true,
              claimNumber: true,
              status: true,
              approvedAmount: true,
            }
          },
          _count: {
            select: {
              payments: true,
              items: true,
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit,
      }),
      prisma.invoice.count({ where })
    ])

    return NextResponse.json({
      invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("Error fetching invoices:", error)
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    )
  }
}

// POST - Create new invoice
export async function POST(request: NextRequest) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Check if user has permission
    if (!["ADMIN", "ACCOUNTANT", "RECEPTIONIST"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You don't have permission to create invoices" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      patientId,
      items,
      discountType = "FIXED",
      discountValue = 0,
      cgstRate = gstConfig.cgstRate,
      sgstRate = gstConfig.sgstRate,
      dueDate,
      notes,
      termsAndConditions,
      paymentTermDays = 0,
      status = "DRAFT",
    } = body

    // Validate required fields
    if (!patientId) {
      return NextResponse.json(
        { error: "Patient is required" },
        { status: 400 }
      )
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: "At least one item is required" },
        { status: 400 }
      )
    }

    // Check if patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId, hospitalId }
    })
    if (!patient) {
      return NextResponse.json(
        { error: "Patient not found" },
        { status: 404 }
      )
    }

    // Validate items
    for (const item of items) {
      if (!item.description || item.quantity <= 0 || item.unitPrice < 0) {
        return NextResponse.json(
          { error: "Invalid item data. Description, quantity (>0), and unit price (>=0) are required" },
          { status: 400 }
        )
      }
    }

    // Calculate totals
    const calculatedTotals = calculateInvoiceTotals(
      items.map((item: any) => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxable: item.taxable !== false
      })),
      discountType as DiscountType,
      discountValue,
      cgstRate,
      sgstRate
    )

    // Generate invoice number
    const invoiceNo = await generateInvoiceNo(prisma)

    // Calculate due date
    const invoiceDate = new Date()
    let calculatedDueDate: Date | null = null
    if (dueDate) {
      calculatedDueDate = new Date(dueDate)
    } else if (paymentTermDays > 0) {
      calculatedDueDate = new Date(invoiceDate)
      calculatedDueDate.setDate(calculatedDueDate.getDate() + paymentTermDays)
    }

    // Create invoice with items
    const invoice = await prisma.invoice.create({
      data: {
        hospitalId,
        invoiceNo,
        patientId,
        dueDate: calculatedDueDate,
        subtotal: calculatedTotals.subtotal,
        discountType: discountType as DiscountType,
        discountValue,
        discountAmount: calculatedTotals.discountAmount,
        taxableAmount: calculatedTotals.taxableAmount,
        cgstRate,
        cgstAmount: calculatedTotals.cgstAmount,
        sgstRate,
        sgstAmount: calculatedTotals.sgstAmount,
        totalAmount: calculatedTotals.totalAmount,
        paidAmount: 0,
        balanceAmount: calculatedTotals.totalAmount,
        status: status as InvoiceStatus,
        notes,
        termsAndConditions,
        items: {
          create: items.map((item: any) => ({
            treatmentId: item.treatmentId || null,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.quantity * item.unitPrice,
            taxable: item.taxable !== false,
          }))
        }
      },
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          }
        },
        items: {
          include: {
            treatment: {
              select: {
                id: true,
                treatmentNo: true,
                procedure: {
                  select: {
                    name: true,
                    code: true
                  }
                }
              }
            }
          }
        }
      }
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    console.error("Error creating invoice:", error)
    return NextResponse.json(
      { error: "Failed to create invoice" },
      { status: 500 }
    )
  }
}
