import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { getDateRangeFromPreset } from "@/lib/billing-utils"

// GET - Generate billing reports
export async function GET(request: NextRequest) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Check if user has permission
    if (!["ADMIN", "ACCOUNTANT"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You don't have permission to view reports" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get("type") || "summary"
    const preset = searchParams.get("preset") || "this_month"
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")

    // Determine date range
    let startDate: Date
    let endDate: Date

    if (dateFrom && dateTo) {
      startDate = new Date(dateFrom)
      endDate = new Date(dateTo)
      endDate.setHours(23, 59, 59, 999)
    } else {
      const range = getDateRangeFromPreset(preset)
      startDate = range.startDate
      endDate = range.endDate
    }

    switch (reportType) {
      case "summary":
        return await getSummaryReport(startDate, endDate, hospitalId)
      case "revenue":
        return await getRevenueReport(startDate, endDate, hospitalId)
      case "payments":
        return await getPaymentsReport(startDate, endDate, hospitalId)
      case "outstanding":
        return await getOutstandingReport(hospitalId)
      case "procedure_revenue":
        return await getProcedureRevenueReport(startDate, endDate, hospitalId)
      case "doctor_revenue":
        return await getDoctorRevenueReport(startDate, endDate, hospitalId)
      case "daily_collection":
        return await getDailyCollectionReport(startDate, endDate, hospitalId)
      default:
        return NextResponse.json(
          { error: "Invalid report type" },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error("Error generating report:", error)
    return NextResponse.json(
      {
        error: "Failed to generate report",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

// Summary Report
async function getSummaryReport(startDate: Date, endDate: Date, hospitalId: string) {
  const dateFilter = {
    gte: startDate,
    lte: endDate,
  }

  const [
    invoiceSummary,
    paymentSummary,
    outstandingSummary,
    insuranceSummary,
  ] = await Promise.all([
    // Invoice summary
    prisma.invoice.aggregate({
      where: { hospitalId, createdAt: dateFilter },
      _sum: { totalAmount: true, discountAmount: true },
      _count: true,
    }),
    // Payment summary
    prisma.payment.aggregate({
      where: {
        hospitalId,
        paymentDate: dateFilter,
        status: "COMPLETED"
      },
      _sum: { amount: true },
      _count: true,
    }),
    // Outstanding summary
    prisma.invoice.aggregate({
      where: {
        hospitalId,
        status: { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE"] }
      },
      _sum: { balanceAmount: true },
      _count: true,
    }),
    // Insurance summary
    prisma.insuranceClaim.aggregate({
      where: {
        hospitalId,
        submittedDate: dateFilter,
        status: { not: "DRAFT" }
      },
      _sum: { claimAmount: true, settledAmount: true },
      _count: true,
    }),
  ])

  // Payment method breakdown
  const paymentMethodBreakdown = await prisma.payment.groupBy({
    by: ['paymentMethod'],
    where: {
      hospitalId,
      paymentDate: dateFilter,
      status: "COMPLETED"
    },
    _sum: { amount: true },
    _count: true,
  })

  // Invoice status breakdown
  const invoiceStatusBreakdown = await prisma.invoice.groupBy({
    by: ['status'],
    where: { hospitalId, createdAt: dateFilter },
    _sum: { totalAmount: true },
    _count: true,
  })

  return NextResponse.json({
    period: { startDate, endDate },
    summary: {
      totalBilled: invoiceSummary._sum.totalAmount || 0,
      totalDiscounts: invoiceSummary._sum.discountAmount || 0,
      invoiceCount: invoiceSummary._count,
      totalCollected: paymentSummary._sum.amount || 0,
      paymentCount: paymentSummary._count,
      totalOutstanding: outstandingSummary._sum.balanceAmount || 0,
      outstandingInvoices: outstandingSummary._count,
      insuranceClaimed: insuranceSummary._sum.claimAmount || 0,
      insuranceSettled: insuranceSummary._sum.settledAmount || 0,
      insuranceClaimCount: insuranceSummary._count,
    },
    breakdowns: {
      byPaymentMethod: paymentMethodBreakdown.map(item => ({
        method: item.paymentMethod,
        amount: item._sum.amount || 0,
        count: item._count,
      })),
      byInvoiceStatus: invoiceStatusBreakdown.map(item => ({
        status: item.status,
        amount: item._sum.totalAmount || 0,
        count: item._count,
      })),
    }
  })
}

// Revenue Report
async function getRevenueReport(startDate: Date, endDate: Date, hospitalId: string) {
  // Get daily revenue data
  const invoices = await prisma.invoice.findMany({
    where: {
      hospitalId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      status: { not: "CANCELLED" }
    },
    select: {
      createdAt: true,
      totalAmount: true,
      paidAmount: true,
      discountAmount: true,
      cgstAmount: true,
      sgstAmount: true,
    },
    orderBy: { createdAt: 'asc' }
  })

  // Group by date
  const dailyRevenue: Record<string, {
    date: string
    billed: number
    collected: number
    discount: number
    tax: number
    count: number
  }> = {}

  invoices.forEach(invoice => {
    const dateKey = invoice.createdAt.toISOString().split('T')[0]
    if (!dailyRevenue[dateKey]) {
      dailyRevenue[dateKey] = {
        date: dateKey,
        billed: 0,
        collected: 0,
        discount: 0,
        tax: 0,
        count: 0,
      }
    }
    dailyRevenue[dateKey].billed += Number(invoice.totalAmount)
    dailyRevenue[dateKey].collected += Number(invoice.paidAmount)
    dailyRevenue[dateKey].discount += Number(invoice.discountAmount)
    dailyRevenue[dateKey].tax += Number(invoice.cgstAmount) + Number(invoice.sgstAmount)
    dailyRevenue[dateKey].count += 1
  })

  // Calculate totals
  const totals = {
    totalBilled: 0,
    totalCollected: 0,
    totalDiscount: 0,
    totalTax: 0,
    invoiceCount: 0,
  }

  Object.values(dailyRevenue).forEach(day => {
    totals.totalBilled += day.billed
    totals.totalCollected += day.collected
    totals.totalDiscount += day.discount
    totals.totalTax += day.tax
    totals.invoiceCount += day.count
  })

  return NextResponse.json({
    period: { startDate, endDate },
    dailyData: Object.values(dailyRevenue),
    totals,
  })
}

// Payments Report
async function getPaymentsReport(startDate: Date, endDate: Date, hospitalId: string) {
  const payments = await prisma.payment.findMany({
    where: {
      hospitalId,
      paymentDate: {
        gte: startDate,
        lte: endDate,
      },
      status: "COMPLETED"
    },
    include: {
      invoice: {
        select: {
          invoiceNo: true,
          patient: {
            select: {
              patientId: true,
              firstName: true,
              lastName: true,
            }
          }
        }
      }
    },
    orderBy: { paymentDate: 'desc' }
  })

  // Group by payment method
  const byMethod: Record<string, {
    method: string
    total: number
    count: number
  }> = {}

  payments.forEach(payment => {
    const method = payment.paymentMethod
    if (!byMethod[method]) {
      byMethod[method] = { method, total: 0, count: 0 }
    }
    byMethod[method].total += Number(payment.amount)
    byMethod[method].count += 1
  })

  // Calculate totals
  const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0)

  return NextResponse.json({
    period: { startDate, endDate },
    payments,
    byMethod: Object.values(byMethod),
    totals: {
      totalAmount,
      totalCount: payments.length,
    }
  })
}

// Outstanding Report
async function getOutstandingReport(hospitalId: string) {
  const outstandingInvoices = await prisma.invoice.findMany({
    where: {
      hospitalId,
      status: { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE"] },
      balanceAmount: { gt: 0 }
    },
    include: {
      patient: {
        select: {
          id: true,
          patientId: true,
          firstName: true,
          lastName: true,
          phone: true,
        }
      }
    },
    orderBy: [
      { dueDate: 'asc' },
      { balanceAmount: 'desc' }
    ]
  })

  // Calculate aging buckets
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const aging = {
    current: { amount: 0, count: 0 },      // Not yet due
    days1_30: { amount: 0, count: 0 },     // 1-30 days overdue
    days31_60: { amount: 0, count: 0 },    // 31-60 days overdue
    days61_90: { amount: 0, count: 0 },    // 61-90 days overdue
    over90: { amount: 0, count: 0 },       // Over 90 days overdue
  }

  outstandingInvoices.forEach(invoice => {
    const balance = Number(invoice.balanceAmount)
    const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : new Date(invoice.createdAt)
    dueDate.setHours(0, 0, 0, 0)

    const daysDiff = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

    if (daysDiff <= 0) {
      aging.current.amount += balance
      aging.current.count += 1
    } else if (daysDiff <= 30) {
      aging.days1_30.amount += balance
      aging.days1_30.count += 1
    } else if (daysDiff <= 60) {
      aging.days31_60.amount += balance
      aging.days31_60.count += 1
    } else if (daysDiff <= 90) {
      aging.days61_90.amount += balance
      aging.days61_90.count += 1
    } else {
      aging.over90.amount += balance
      aging.over90.count += 1
    }
  })

  const totalOutstanding = outstandingInvoices.reduce(
    (sum, inv) => sum + Number(inv.balanceAmount),
    0
  )

  return NextResponse.json({
    invoices: outstandingInvoices,
    aging,
    totals: {
      totalOutstanding,
      invoiceCount: outstandingInvoices.length,
    }
  })
}

// Procedure Revenue Report
async function getProcedureRevenueReport(startDate: Date, endDate: Date, hospitalId: string) {
  const treatments = await prisma.treatment.findMany({
    where: {
      hospitalId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      status: { in: ["COMPLETED", "IN_PROGRESS"] }
    },
    include: {
      procedure: {
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
        }
      }
    }
  })

  // Group by procedure
  const byProcedure: Record<string, {
    procedureId: string
    code: string
    name: string
    category: string
    totalRevenue: number
    count: number
    avgRevenue: number
  }> = {}

  treatments.forEach(treatment => {
    if (!treatment.procedure) return

    const procId = treatment.procedure.id
    if (!byProcedure[procId]) {
      byProcedure[procId] = {
        procedureId: procId,
        code: treatment.procedure.code,
        name: treatment.procedure.name,
        category: treatment.procedure.category,
        totalRevenue: 0,
        count: 0,
        avgRevenue: 0,
      }
    }
    byProcedure[procId].totalRevenue += Number(treatment.cost || 0)
    byProcedure[procId].count += 1
  })

  // Calculate averages
  Object.values(byProcedure).forEach(proc => {
    proc.avgRevenue = proc.count > 0 ? proc.totalRevenue / proc.count : 0
  })

  // Group by category
  const byCategory: Record<string, {
    category: string
    totalRevenue: number
    count: number
  }> = {}

  Object.values(byProcedure).forEach(proc => {
    const cat = proc.category
    if (!byCategory[cat]) {
      byCategory[cat] = { category: cat, totalRevenue: 0, count: 0 }
    }
    byCategory[cat].totalRevenue += proc.totalRevenue
    byCategory[cat].count += proc.count
  })

  // Sort by revenue
  const proceduresList = Object.values(byProcedure).sort(
    (a, b) => b.totalRevenue - a.totalRevenue
  )

  const totalRevenue = proceduresList.reduce((sum, p) => sum + p.totalRevenue, 0)
  const totalTreatments = proceduresList.reduce((sum, p) => sum + p.count, 0)

  return NextResponse.json({
    period: { startDate, endDate },
    byProcedure: proceduresList,
    byCategory: Object.values(byCategory).sort((a, b) => b.totalRevenue - a.totalRevenue),
    totals: {
      totalRevenue,
      totalTreatments,
    }
  })
}

// Doctor Revenue Report
async function getDoctorRevenueReport(startDate: Date, endDate: Date, hospitalId: string) {
  const treatments = await prisma.treatment.findMany({
    where: {
      hospitalId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      status: { in: ["COMPLETED", "IN_PROGRESS"] }
    },
    include: {
      doctor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          specialization: true,
        }
      },
      procedure: {
        select: {
          name: true,
          category: true,
        }
      }
    }
  })

  // Group by doctor
  const byDoctor: Record<string, {
    doctorId: string
    name: string
    specialization: string | null
    totalRevenue: number
    treatmentCount: number
    avgPerTreatment: number
    procedures: Record<string, number>
  }> = {}

  treatments.forEach(treatment => {
    if (!treatment.doctor) return

    const docId = treatment.doctor.id
    const docName = `${treatment.doctor.firstName} ${treatment.doctor.lastName}`

    if (!byDoctor[docId]) {
      byDoctor[docId] = {
        doctorId: docId,
        name: docName,
        specialization: treatment.doctor.specialization,
        totalRevenue: 0,
        treatmentCount: 0,
        avgPerTreatment: 0,
        procedures: {},
      }
    }

    byDoctor[docId].totalRevenue += Number(treatment.cost || 0)
    byDoctor[docId].treatmentCount += 1

    if (treatment.procedure) {
      const procName = treatment.procedure.name
      byDoctor[docId].procedures[procName] = (byDoctor[docId].procedures[procName] || 0) + 1
    }
  })

  // Calculate averages and format procedures
  const doctorsList = Object.values(byDoctor).map(doc => {
    doc.avgPerTreatment = doc.treatmentCount > 0 ? doc.totalRevenue / doc.treatmentCount : 0

    // Get top 5 procedures
    const topProcedures = Object.entries(doc.procedures)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    return {
      ...doc,
      topProcedures,
    }
  }).sort((a, b) => b.totalRevenue - a.totalRevenue)

  const totalRevenue = doctorsList.reduce((sum, d) => sum + d.totalRevenue, 0)
  const totalTreatments = doctorsList.reduce((sum, d) => sum + d.treatmentCount, 0)

  return NextResponse.json({
    period: { startDate, endDate },
    byDoctor: doctorsList,
    totals: {
      totalRevenue,
      totalTreatments,
      doctorCount: doctorsList.length,
    }
  })
}

// Daily Collection Report
async function getDailyCollectionReport(startDate: Date, endDate: Date, hospitalId: string) {
  const payments = await prisma.payment.findMany({
    where: {
      hospitalId,
      paymentDate: {
        gte: startDate,
        lte: endDate,
      },
      status: "COMPLETED"
    },
    include: {
      invoice: {
        select: {
          invoiceNo: true,
          patient: {
            select: {
              patientId: true,
              firstName: true,
              lastName: true,
            }
          }
        }
      }
    },
    orderBy: { paymentDate: 'asc' }
  })

  // Group by date
  const dailyCollection: Record<string, {
    date: string
    cash: number
    card: number
    upi: number
    bankTransfer: number
    cheque: number
    insurance: number
    wallet: number
    total: number
    count: number
    payments: any[]
  }> = {}

  payments.forEach(payment => {
    const dateKey = payment.paymentDate.toISOString().split('T')[0]
    if (!dailyCollection[dateKey]) {
      dailyCollection[dateKey] = {
        date: dateKey,
        cash: 0,
        card: 0,
        upi: 0,
        bankTransfer: 0,
        cheque: 0,
        insurance: 0,
        wallet: 0,
        total: 0,
        count: 0,
        payments: [],
      }
    }

    const amount = Number(payment.amount)
    dailyCollection[dateKey].total += amount
    dailyCollection[dateKey].count += 1

    switch (payment.paymentMethod) {
      case "CASH":
        dailyCollection[dateKey].cash += amount
        break
      case "CARD":
        dailyCollection[dateKey].card += amount
        break
      case "UPI":
        dailyCollection[dateKey].upi += amount
        break
      case "BANK_TRANSFER":
        dailyCollection[dateKey].bankTransfer += amount
        break
      case "CHEQUE":
        dailyCollection[dateKey].cheque += amount
        break
      case "INSURANCE":
        dailyCollection[dateKey].insurance += amount
        break
      case "WALLET":
        dailyCollection[dateKey].wallet += amount
        break
    }

    dailyCollection[dateKey].payments.push({
      paymentNo: payment.paymentNo,
      amount: payment.amount,
      method: payment.paymentMethod,
      invoiceNo: payment.invoice.invoiceNo,
      patient: payment.invoice.patient
        ? `${payment.invoice.patient.firstName} ${payment.invoice.patient.lastName}`
        : 'Unknown',
    })
  })

  const totalCollection = Object.values(dailyCollection).reduce(
    (sum, day) => sum + day.total,
    0
  )

  return NextResponse.json({
    period: { startDate, endDate },
    dailyData: Object.values(dailyCollection),
    totals: {
      totalCollection,
      totalPayments: payments.length,
      daysWithCollection: Object.keys(dailyCollection).length,
    }
  })
}
