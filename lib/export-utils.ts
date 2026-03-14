/**
 * Client-side CSV and Excel export utilities.
 */

export function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return

  const headers = Object.keys(data[0])
  const csvRows = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = row[h]
          const str = val == null ? "" : String(val)
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`
          }
          return str
        })
        .join(",")
    ),
  ]

  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" })
  triggerDownload(blob, `${filename}.csv`)
}

export async function downloadExcel(
  data: Record<string, unknown>[],
  filename: string,
  sheetName = "Sheet1"
) {
  if (data.length === 0) return

  // Dynamic import to avoid bundling ExcelJS unless needed
  const ExcelJS = (await import("exceljs")).default
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName)

  const headers = Object.keys(data[0])
  sheet.addRow(headers)

  // Style header row
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  }

  data.forEach((row) => {
    sheet.addRow(headers.map((h) => row[h] ?? ""))
  })

  // Auto-width columns
  headers.forEach((_, i) => {
    const col = sheet.getColumn(i + 1)
    let maxLen = headers[i].length
    data.forEach((row) => {
      const len = String(row[headers[i]] ?? "").length
      if (len > maxLen) maxLen = len
    })
    col.width = Math.min(maxLen + 4, 50)
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  triggerDownload(blob, `${filename}.xlsx`)
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
