import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths, subQuarters, subYears, differenceInDays } from 'date-fns'

// Helper function to get date range from preset
function getDateRange(preset: string): { from: Date; to: Date } {
  const now = new Date()

  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) }
    case 'yesterday':
      return { from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)) }
    case 'this_week':
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) }
    case 'last_week':
      return { from: startOfWeek(subDays(now, 7), { weekStartsOn: 1 }), to: endOfWeek(subDays(now, 7), { weekStartsOn: 1 }) }
    case 'this_month':
      return { from: startOfMonth(now), to: endOfMonth(now) }
    case 'last_month':
      return { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) }
    case 'this_quarter':
      return { from: startOfQuarter(now), to: endOfQuarter(now) }
    case 'last_quarter':
      return { from: startOfQuarter(subQuarters(now, 1)), to: endOfQuarter(subQuarters(now, 1)) }
    case 'this_year':
      return { from: startOfYear(now), to: endOfYear(now) }
    case 'last_year':
      return { from: startOfYear(subYears(now, 1)), to: endOfYear(subYears(now, 1)) }
    default:
      return { from: startOfMonth(now), to: endOfMonth(now) }
  }
}

// Patient Analytics
async function getPatientAnalytics(dateFrom: Date, dateTo: Date, hospitalId: string) {
  // Get total patients in the date range
  const patientsInRange = await prisma.patient.findMany({
    where: {
      hospitalId,
      createdAt: {
        gte: dateFrom,
        lte: dateTo,
      },
      isActive: true,
    },
    select: {
      id: true,
      gender: true,
      dateOfBirth: true,
      referredBy: true,
      createdAt: true,
    },
  })

  // Get patients with repeat appointments
  const patientsWithMultipleAppointments = await prisma.patient.findMany({
    where: {
      hospitalId,
      appointments: {
        some: {
          createdAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
      },
    },
    include: {
      _count: {
        select: {
          appointments: {
            where: {
              createdAt: {
                lte: dateTo,
              },
            },
          },
        },
      },
    },
  })

  const returningPatients = patientsWithMultipleAppointments.filter(p => p._count.appointments > 1).length
  const newPatients = patientsInRange.length
  const totalPatients = Math.max(newPatients, patientsWithMultipleAppointments.length)

  // Calculate demographics
  const demographics = {
    male: patientsInRange.filter(p => p.gender === 'MALE').length,
    female: patientsInRange.filter(p => p.gender === 'FEMALE').length,
    other: patientsInRange.filter(p => p.gender === 'OTHER').length,
  }

  // Calculate age groups
  const getAgeGroup = (dob: Date | null) => {
    if (!dob) return 'Unknown'
    const age = differenceInDays(new Date(), dob) / 365
    if (age < 18) return '0-17'
    if (age < 30) return '18-29'
    if (age < 45) return '30-44'
    if (age < 60) return '45-59'
    return '60+'
  }

  const ageGroupCounts = patientsInRange.reduce((acc, p) => {
    const group = getAgeGroup(p.dateOfBirth)
    acc[group] = (acc[group] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const ageGroups = Object.entries(ageGroupCounts).map(([label, count]) => ({
    label,
    count,
  }))

  // Calculate acquisition sources
  const sourceCounts = patientsInRange.reduce((acc, p) => {
    const source = p.referredBy || 'Direct Walk-in'
    acc[source] = (acc[source] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const acquisitionSources = Object.entries(sourceCounts).map(([source, count]) => ({
    source,
    count,
    percentage: totalPatients > 0 ? (count / totalPatients) * 100 : 0,
  }))

  // Calculate retention rate
  const retentionRate = totalPatients > 0 ? (returningPatients / totalPatients) * 100 : 0

  return {
    newPatients,
    returningPatients,
    totalPatients,
    retentionRate,
    demographics,
    ageGroups,
    acquisitionSources,
  }
}

// Clinical Analytics
async function getClinicalAnalytics(dateFrom: Date, dateTo: Date, hospitalId: string) {
  const treatments = await prisma.treatment.findMany({
    where: {
      hospitalId,
      createdAt: {
        gte: dateFrom,
        lte: dateTo,
      },
    },
    include: {
      procedure: true,
    },
  })

  const totalTreatments = treatments.length
  const completedTreatments = treatments.filter(t => t.status === 'COMPLETED').length
  const inProgressTreatments = treatments.filter(t => t.status === 'IN_PROGRESS').length
  const completionRate = totalTreatments > 0 ? (completedTreatments / totalTreatments) * 100 : 0

  // Calculate average treatment duration
  const treatmentsWithDuration = treatments.filter(t => t.startTime && t.endTime)
  const avgTreatmentDuration = treatmentsWithDuration.length > 0
    ? treatmentsWithDuration.reduce((sum, t) => {
        const duration = t.endTime && t.startTime
          ? (t.endTime.getTime() - t.startTime.getTime()) / (1000 * 60)
          : 0
        return sum + duration
      }, 0) / treatmentsWithDuration.length
    : 0

  // Get common procedures
  const procedureCounts = treatments.reduce((acc, t) => {
    const procId = t.procedureId
    if (!acc[procId]) {
      acc[procId] = {
        procedureId: procId,
        name: t.procedure.name,
        code: t.procedure.code,
        count: 0,
        completed: 0,
      }
    }
    acc[procId].count++
    if (t.status === 'COMPLETED') {
      acc[procId].completed++
    }
    return acc
  }, {} as Record<string, any>)

  const commonProcedures = Object.values(procedureCounts)
    .map((p: any) => ({
      ...p,
      successRate: p.count > 0 ? (p.completed / p.count) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Procedures by category
  const categoryCounts = treatments.reduce((acc, t) => {
    const category = t.procedure.category
    acc[category] = (acc[category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const proceduresByCategory = Object.entries(categoryCounts).map(([category, count]) => ({
    category,
    count,
    percentage: totalTreatments > 0 ? (count / totalTreatments) * 100 : 0,
  }))

  return {
    totalTreatments,
    completedTreatments,
    inProgressTreatments,
    completionRate,
    avgTreatmentDuration: Math.round(avgTreatmentDuration),
    commonProcedures,
    proceduresByCategory,
  }
}

// Financial Analytics
async function getFinancialAnalytics(dateFrom: Date, dateTo: Date, hospitalId: string) {
  const invoices = await prisma.invoice.findMany({
    where: {
      hospitalId,
      createdAt: {
        gte: dateFrom,
        lte: dateTo,
      },
    },
    include: {
      payments: true,
    },
  })

  const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0)
  const totalPaid = invoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0)
  const outstandingAmount = invoices.reduce((sum, inv) => sum + Number(inv.balanceAmount), 0)

  // Get expenses from inventory purchases
  const purchases = await prisma.stockTransaction.findMany({
    where: {
      hospitalId,
      type: 'PURCHASE',
      createdAt: {
        gte: dateFrom,
        lte: dateTo,
      },
    },
  })

  const totalExpenses = purchases.reduce((sum, p) => sum + Number(p.totalPrice || 0), 0)

  const profitMargin = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0
  const avgBillValue = invoices.length > 0 ? totalRevenue / invoices.length : 0
  const collectionEfficiency = totalRevenue > 0 ? (totalPaid / totalRevenue) * 100 : 0

  // Revenue by month (for trend)
  const monthlyRevenue = invoices.reduce((acc, inv) => {
    const month = inv.createdAt.toLocaleString('default', { month: 'short', year: '2-digit' })
    if (!acc[month]) {
      acc[month] = { revenue: 0, expenses: 0 }
    }
    acc[month].revenue += Number(inv.totalAmount)
    return acc
  }, {} as Record<string, { revenue: number; expenses: number }>)

  purchases.forEach(p => {
    const month = p.createdAt.toLocaleString('default', { month: 'short', year: '2-digit' })
    if (!monthlyRevenue[month]) {
      monthlyRevenue[month] = { revenue: 0, expenses: 0 }
    }
    monthlyRevenue[month].expenses += Number(p.totalPrice || 0)
  })

  const revenueByMonth = Object.entries(monthlyRevenue).map(([month, data]) => ({
    month,
    revenue: data.revenue,
    expenses: data.expenses,
    profit: data.revenue - data.expenses,
  }))

  // Payment method breakdown
  const payments = await prisma.payment.findMany({
    where: {
      hospitalId,
      paymentDate: {
        gte: dateFrom,
        lte: dateTo,
      },
      status: 'COMPLETED',
    },
  })

  const methodCounts = payments.reduce((acc, p) => {
    const method = p.paymentMethod
    acc[method] = (acc[method] || 0) + Number(p.amount)
    return acc
  }, {} as Record<string, number>)

  const totalPayments = Object.values(methodCounts).reduce((sum, amt) => sum + amt, 0)

  const paymentMethodBreakdown = Object.entries(methodCounts).map(([method, amount]) => ({
    method,
    amount,
    percentage: totalPayments > 0 ? (amount / totalPayments) * 100 : 0,
  }))

  return {
    totalRevenue,
    totalExpenses,
    profitMargin,
    avgBillValue,
    collectionEfficiency,
    revenueByMonth,
    paymentMethodBreakdown,
    outstandingAmount,
  }
}

// Operational Analytics
async function getOperationalAnalytics(dateFrom: Date, dateTo: Date, hospitalId: string) {
  const appointments = await prisma.appointment.findMany({
    where: {
      hospitalId,
      scheduledDate: {
        gte: dateFrom,
        lte: dateTo,
      },
    },
    include: {
      doctor: {
        include: {
          user: true,
        },
      },
    },
  })

  const totalAppointments = appointments.length
  const completedAppointments = appointments.filter(a => a.status === 'COMPLETED').length
  const cancelledAppointments = appointments.filter(a => a.status === 'CANCELLED').length
  const noShowCount = appointments.filter(a => a.status === 'NO_SHOW').length
  const noShowRate = totalAppointments > 0 ? (noShowCount / totalAppointments) * 100 : 0
  const appointmentUtilization = totalAppointments > 0 ? (completedAppointments / totalAppointments) * 100 : 0

  // Calculate average wait time
  const appointmentsWithWaitTime = appointments.filter(a => a.waitTime !== null)
  const avgWaitTime = appointmentsWithWaitTime.length > 0
    ? appointmentsWithWaitTime.reduce((sum, a) => sum + (a.waitTime || 0), 0) / appointmentsWithWaitTime.length
    : 0

  // Staff productivity
  const staffMap = new Map()

  for (const appointment of appointments) {
    const staffId = appointment.doctorId
    if (!staffMap.has(staffId)) {
      staffMap.set(staffId, {
        staffId,
        name: `${appointment.doctor.firstName} ${appointment.doctor.lastName}`,
        role: appointment.doctor.user.role,
        appointmentsHandled: 0,
        treatmentsCompleted: 0,
        revenue: 0,
      })
    }
    const staff = staffMap.get(staffId)
    staff.appointmentsHandled++
  }

  // Get treatments by doctor
  const treatments = await prisma.treatment.findMany({
    where: {
      hospitalId,
      createdAt: {
        gte: dateFrom,
        lte: dateTo,
      },
    },
  })

  treatments.forEach(t => {
    if (staffMap.has(t.doctorId)) {
      const staff = staffMap.get(t.doctorId)
      if (t.status === 'COMPLETED') {
        staff.treatmentsCompleted++
      }
      staff.revenue += Number(t.cost)
    }
  })

  const staffProductivity = Array.from(staffMap.values())

  // Inventory turnover (simplified)
  const stockTransactions = await prisma.stockTransaction.findMany({
    where: {
      hospitalId,
      createdAt: {
        gte: dateFrom,
        lte: dateTo,
      },
    },
  })

  const totalStockUsed = stockTransactions
    .filter(t => ['SALE', 'CONSUMPTION'].includes(t.type))
    .reduce((sum, t) => sum + t.quantity, 0)

  const avgInventoryValue = await prisma.inventoryItem.aggregate({
    where: { hospitalId },
    _sum: {
      currentStock: true,
    },
  })

  const inventoryTurnover = (avgInventoryValue._sum.currentStock || 0) > 0
    ? totalStockUsed / (avgInventoryValue._sum.currentStock || 1)
    : 0

  // Low stock items
  const lowStockItems = await prisma.inventoryItem.count({
    where: {
      hospitalId,
      currentStock: {
        lte: prisma.inventoryItem.fields.reorderLevel,
      },
      isActive: true,
    },
  })

  return {
    totalAppointments,
    completedAppointments,
    cancelledAppointments,
    noShowCount,
    noShowRate,
    appointmentUtilization,
    avgWaitTime: Math.round(avgWaitTime),
    staffProductivity,
    inventoryTurnover,
    lowStockItems,
  }
}

export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'patient'
    const preset = searchParams.get('preset') || 'this_month'
    const dateFromParam = searchParams.get('dateFrom')
    const dateToParam = searchParams.get('dateTo')

    let dateFrom: Date
    let dateTo: Date

    if (dateFromParam && dateToParam) {
      dateFrom = new Date(dateFromParam)
      dateTo = new Date(dateToParam)
    } else {
      const range = getDateRange(preset)
      dateFrom = range.from
      dateTo = range.to
    }

    let data

    switch (type) {
      case 'patient':
        data = await getPatientAnalytics(dateFrom, dateTo, hospitalId)
        break
      case 'clinical':
        data = await getClinicalAnalytics(dateFrom, dateTo, hospitalId)
        break
      case 'financial':
        data = await getFinancialAnalytics(dateFrom, dateTo, hospitalId)
        break
      case 'operational':
        data = await getOperationalAnalytics(dateFrom, dateTo, hospitalId)
        break
      default:
        return NextResponse.json({ error: 'Invalid analytics type' }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    )
  }
}
