import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAndRole } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import ExcelJS from 'exceljs'
import { format } from 'date-fns'

async function generateExcelReport(type: string, data: any, dateRange: string, hospitalName: string) {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(`${type} Analytics`)

  // Set up common styles
  const headerStyle = {
    font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF0070C0' } },
    alignment: { vertical: 'middle' as const, horizontal: 'center' as const },
    border: {
      top: { style: 'thin' as const },
      left: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      right: { style: 'thin' as const }
    }
  }

  // Add title
  worksheet.mergeCells('A1:E1')
  const titleCell = worksheet.getCell('A1')
  titleCell.value = `${type.charAt(0).toUpperCase() + type.slice(1)} Analytics Report`
  titleCell.font = { bold: true, size: 16 }
  titleCell.alignment = { horizontal: 'center' }

  // Add date range
  worksheet.mergeCells('A2:E2')
  const dateCell = worksheet.getCell('A2')
  dateCell.value = `Period: ${dateRange}`
  dateCell.font = { italic: true }
  dateCell.alignment = { horizontal: 'center' }

  worksheet.addRow([]) // Empty row

  // Generate content based on type
  switch (type) {
    case 'patient':
      worksheet.addRow(['Metric', 'Value']).eachCell(cell => {
        cell.style = headerStyle
      })
      worksheet.addRow(['New Patients', data.newPatients])
      worksheet.addRow(['Returning Patients', data.returningPatients])
      worksheet.addRow(['Total Patients', data.totalPatients])
      worksheet.addRow(['Retention Rate', `${data.retentionRate.toFixed(2)}%`])

      worksheet.addRow([]) // Empty row
      worksheet.addRow(['Gender Distribution']).eachCell(cell => {
        cell.font = { bold: true }
      })
      worksheet.addRow(['Male', data.demographics.male])
      worksheet.addRow(['Female', data.demographics.female])
      worksheet.addRow(['Other', data.demographics.other])

      if (data.acquisitionSources.length > 0) {
        worksheet.addRow([]) // Empty row
        worksheet.addRow(['Acquisition Source', 'Count', 'Percentage']).eachCell(cell => {
          cell.style = headerStyle
        })
        data.acquisitionSources.forEach((source: any) => {
          worksheet.addRow([source.source, source.count, `${source.percentage.toFixed(2)}%`])
        })
      }
      break

    case 'clinical':
      worksheet.addRow(['Metric', 'Value']).eachCell(cell => {
        cell.style = headerStyle
      })
      worksheet.addRow(['Total Treatments', data.totalTreatments])
      worksheet.addRow(['Completed Treatments', data.completedTreatments])
      worksheet.addRow(['In Progress', data.inProgressTreatments])
      worksheet.addRow(['Completion Rate', `${data.completionRate.toFixed(2)}%`])
      worksheet.addRow(['Avg. Treatment Duration (mins)', data.avgTreatmentDuration])

      if (data.commonProcedures.length > 0) {
        worksheet.addRow([]) // Empty row
        worksheet.addRow(['Procedure', 'Code', 'Count', 'Success Rate']).eachCell(cell => {
          cell.style = headerStyle
        })
        data.commonProcedures.forEach((proc: any) => {
          worksheet.addRow([proc.name, proc.code, proc.count, `${proc.successRate.toFixed(2)}%`])
        })
      }
      break

    case 'financial':
      worksheet.addRow(['Metric', 'Value (INR)']).eachCell(cell => {
        cell.style = headerStyle
      })
      worksheet.addRow(['Total Revenue', data.totalRevenue.toFixed(2)])
      worksheet.addRow(['Total Expenses', data.totalExpenses.toFixed(2)])
      worksheet.addRow(['Profit Margin', `${data.profitMargin.toFixed(2)}%`])
      worksheet.addRow(['Avg. Bill Value', data.avgBillValue.toFixed(2)])
      worksheet.addRow(['Collection Efficiency', `${data.collectionEfficiency.toFixed(2)}%`])
      worksheet.addRow(['Outstanding Amount', data.outstandingAmount.toFixed(2)])

      if (data.paymentMethodBreakdown.length > 0) {
        worksheet.addRow([]) // Empty row
        worksheet.addRow(['Payment Method', 'Amount (INR)', 'Percentage']).eachCell(cell => {
          cell.style = headerStyle
        })
        data.paymentMethodBreakdown.forEach((method: any) => {
          worksheet.addRow([method.method, method.amount.toFixed(2), `${method.percentage.toFixed(2)}%`])
        })
      }

      if (data.revenueByMonth.length > 0) {
        worksheet.addRow([]) // Empty row
        worksheet.addRow(['Month', 'Revenue', 'Expenses', 'Profit']).eachCell(cell => {
          cell.style = headerStyle
        })
        data.revenueByMonth.forEach((month: any) => {
          worksheet.addRow([
            month.month,
            month.revenue.toFixed(2),
            month.expenses.toFixed(2),
            month.profit.toFixed(2)
          ])
        })
      }
      break

    case 'operational':
      worksheet.addRow(['Metric', 'Value']).eachCell(cell => {
        cell.style = headerStyle
      })
      worksheet.addRow(['Total Appointments', data.totalAppointments])
      worksheet.addRow(['Completed Appointments', data.completedAppointments])
      worksheet.addRow(['Cancelled Appointments', data.cancelledAppointments])
      worksheet.addRow(['No-Show Count', data.noShowCount])
      worksheet.addRow(['No-Show Rate', `${data.noShowRate.toFixed(2)}%`])
      worksheet.addRow(['Appointment Utilization', `${data.appointmentUtilization.toFixed(2)}%`])
      worksheet.addRow(['Avg. Wait Time (mins)', data.avgWaitTime])
      worksheet.addRow(['Inventory Turnover', data.inventoryTurnover.toFixed(2)])
      worksheet.addRow(['Low Stock Items', data.lowStockItems])

      if (data.staffProductivity.length > 0) {
        worksheet.addRow([]) // Empty row
        worksheet.addRow(['Staff Member', 'Role', 'Appointments', 'Treatments', 'Revenue (INR)']).eachCell(cell => {
          cell.style = headerStyle
        })
        data.staffProductivity.forEach((staff: any) => {
          worksheet.addRow([
            staff.name,
            staff.role,
            staff.appointmentsHandled,
            staff.treatmentsCompleted,
            staff.revenue.toFixed(2)
          ])
        })
      }
      break
  }

  // Auto-fit columns
  worksheet.columns.forEach((column) => {
    let maxLength = 0
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const cellValue = cell.value ? cell.value.toString() : ''
      maxLength = Math.max(maxLength, cellValue.length)
    })
    column.width = Math.min(maxLength + 2, 50)
  })

  return workbook
}

async function generatePDFReport(type: string, data: any, dateRange: string, hospitalName: string) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #0070C0; text-align: center; }
    h2 { color: #333; border-bottom: 2px solid #0070C0; padding-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background-color: #0070C0; color: white; padding: 10px; text-align: left; }
    td { padding: 8px; border-bottom: 1px solid #ddd; }
    .metric { font-weight: bold; }
    .value { text-align: right; }
    .footer { text-align: center; margin-top: 40px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <h1>${type.charAt(0).toUpperCase() + type.slice(1)} Analytics Report</h1>
  <p style="text-align: center; color: #666;">Period: ${dateRange}</p>
  <p style="text-align: center; color: #666;">Generated on: ${format(new Date(), 'PPpp')}</p>

  ${type === 'patient' ? `
    <h2>Patient Overview</h2>
    <table>
      <tr><td class="metric">New Patients</td><td class="value">${data.newPatients}</td></tr>
      <tr><td class="metric">Returning Patients</td><td class="value">${data.returningPatients}</td></tr>
      <tr><td class="metric">Total Patients</td><td class="value">${data.totalPatients}</td></tr>
      <tr><td class="metric">Retention Rate</td><td class="value">${data.retentionRate.toFixed(2)}%</td></tr>
    </table>

    <h2>Gender Distribution</h2>
    <table>
      <tr><td class="metric">Male</td><td class="value">${data.demographics.male}</td></tr>
      <tr><td class="metric">Female</td><td class="value">${data.demographics.female}</td></tr>
      <tr><td class="metric">Other</td><td class="value">${data.demographics.other}</td></tr>
    </table>

    ${data.acquisitionSources.length > 0 ? `
      <h2>Acquisition Sources</h2>
      <table>
        <tr><th>Source</th><th>Count</th><th>Percentage</th></tr>
        ${data.acquisitionSources.map((s: any) => `
          <tr><td>${s.source}</td><td>${s.count}</td><td>${s.percentage.toFixed(2)}%</td></tr>
        `).join('')}
      </table>
    ` : ''}
  ` : ''}

  ${type === 'clinical' ? `
    <h2>Clinical Overview</h2>
    <table>
      <tr><td class="metric">Total Treatments</td><td class="value">${data.totalTreatments}</td></tr>
      <tr><td class="metric">Completed</td><td class="value">${data.completedTreatments}</td></tr>
      <tr><td class="metric">In Progress</td><td class="value">${data.inProgressTreatments}</td></tr>
      <tr><td class="metric">Completion Rate</td><td class="value">${data.completionRate.toFixed(2)}%</td></tr>
      <tr><td class="metric">Avg. Duration (mins)</td><td class="value">${data.avgTreatmentDuration}</td></tr>
    </table>

    ${data.commonProcedures.length > 0 ? `
      <h2>Common Procedures</h2>
      <table>
        <tr><th>Procedure</th><th>Code</th><th>Count</th><th>Success Rate</th></tr>
        ${data.commonProcedures.map((p: any) => `
          <tr><td>${p.name}</td><td>${p.code}</td><td>${p.count}</td><td>${p.successRate.toFixed(2)}%</td></tr>
        `).join('')}
      </table>
    ` : ''}
  ` : ''}

  ${type === 'financial' ? `
    <h2>Financial Overview</h2>
    <table>
      <tr><td class="metric">Total Revenue</td><td class="value">₹${data.totalRevenue.toFixed(2)}</td></tr>
      <tr><td class="metric">Total Expenses</td><td class="value">₹${data.totalExpenses.toFixed(2)}</td></tr>
      <tr><td class="metric">Profit Margin</td><td class="value">${data.profitMargin.toFixed(2)}%</td></tr>
      <tr><td class="metric">Avg. Bill Value</td><td class="value">₹${data.avgBillValue.toFixed(2)}</td></tr>
      <tr><td class="metric">Collection Efficiency</td><td class="value">${data.collectionEfficiency.toFixed(2)}%</td></tr>
      <tr><td class="metric">Outstanding Amount</td><td class="value">₹${data.outstandingAmount.toFixed(2)}</td></tr>
    </table>

    ${data.paymentMethodBreakdown.length > 0 ? `
      <h2>Payment Methods</h2>
      <table>
        <tr><th>Method</th><th>Amount (₹)</th><th>Percentage</th></tr>
        ${data.paymentMethodBreakdown.map((m: any) => `
          <tr><td>${m.method}</td><td>₹${m.amount.toFixed(2)}</td><td>${m.percentage.toFixed(2)}%</td></tr>
        `).join('')}
      </table>
    ` : ''}
  ` : ''}

  ${type === 'operational' ? `
    <h2>Operational Overview</h2>
    <table>
      <tr><td class="metric">Total Appointments</td><td class="value">${data.totalAppointments}</td></tr>
      <tr><td class="metric">Completed</td><td class="value">${data.completedAppointments}</td></tr>
      <tr><td class="metric">Cancelled</td><td class="value">${data.cancelledAppointments}</td></tr>
      <tr><td class="metric">No-Show Count</td><td class="value">${data.noShowCount}</td></tr>
      <tr><td class="metric">No-Show Rate</td><td class="value">${data.noShowRate.toFixed(2)}%</td></tr>
      <tr><td class="metric">Utilization</td><td class="value">${data.appointmentUtilization.toFixed(2)}%</td></tr>
      <tr><td class="metric">Avg. Wait Time (mins)</td><td class="value">${data.avgWaitTime}</td></tr>
      <tr><td class="metric">Inventory Turnover</td><td class="value">${data.inventoryTurnover.toFixed(2)}</td></tr>
      <tr><td class="metric">Low Stock Items</td><td class="value">${data.lowStockItems}</td></tr>
    </table>

    ${data.staffProductivity.length > 0 ? `
      <h2>Staff Productivity</h2>
      <table>
        <tr><th>Staff</th><th>Role</th><th>Appointments</th><th>Treatments</th><th>Revenue (₹)</th></tr>
        ${data.staffProductivity.map((s: any) => `
          <tr><td>${s.name}</td><td>${s.role}</td><td>${s.appointmentsHandled}</td><td>${s.treatmentsCompleted}</td><td>₹${s.revenue.toFixed(2)}</td></tr>
        `).join('')}
      </table>
    ` : ''}
  ` : ''}

  <div class="footer">
    <p>${hospitalName}</p>
    <p>This is a system-generated report</p>
  </div>
</body>
</html>
  `

  return html
}

export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get hospital info for the report header
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { name: true }
    })

    const hospitalName = hospital?.name || 'Dental Hospital'

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'patient'
    const exportFormat = searchParams.get('format') || 'excel'
    const preset = searchParams.get('preset') || 'this_month'
    const dateFromParam = searchParams.get('dateFrom')
    const dateToParam = searchParams.get('dateTo')

    // Fetch the analytics data (reuse the analytics endpoint logic)
    const analyticsUrl = new URL('/api/reports/analytics', request.url)
    analyticsUrl.searchParams.set('type', type)
    analyticsUrl.searchParams.set('preset', preset)
    if (dateFromParam) analyticsUrl.searchParams.set('dateFrom', dateFromParam)
    if (dateToParam) analyticsUrl.searchParams.set('dateTo', dateToParam)

    const analyticsResponse = await fetch(analyticsUrl.toString(), {
      headers: {
        cookie: request.headers.get('cookie') || '',
      },
    })

    if (!analyticsResponse.ok) {
      throw new Error('Failed to fetch analytics data')
    }

    const data = await analyticsResponse.json()

    const dateRange = dateFromParam && dateToParam
      ? `${format(new Date(dateFromParam), 'PP')} - ${format(new Date(dateToParam), 'PP')}`
      : preset.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

    if (exportFormat === 'excel') {
      const workbook = await generateExcelReport(type, data, dateRange, hospitalName)
      const buffer = await workbook.xlsx.writeBuffer()

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${type}_analytics_${Date.now()}.xlsx"`,
        },
      })
    } else if (exportFormat === 'pdf') {
      const html = await generatePDFReport(type, data, dateRange, hospitalName)

      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `inline; filename="${type}_analytics_${Date.now()}.html"`,
        },
      })
    }

    return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
  } catch (error) {
    console.error('Export API error:', error)
    return NextResponse.json(
      { error: 'Failed to export report' },
      { status: 500 }
    )
  }
}
