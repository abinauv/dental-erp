/**
 * File parsers for data import — CSV, Excel, and PDF.
 * Returns a uniform { columns, rows, totalRows } structure.
 */
import ExcelJS from "exceljs"
import { Readable } from "stream"

export interface ParseResult {
  columns: string[]
  rows: Record<string, string>[]
  totalRows: number
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------
export async function parseFile(
  buffer: Buffer,
  fileType: string
): Promise<ParseResult> {
  switch (fileType) {
    case "csv":
      return parseCSV(buffer)
    case "xlsx":
    case "xls":
      return parseExcel(buffer)
    case "pdf":
      return parsePDF(buffer)
    default:
      throw new Error(`Unsupported file type: ${fileType}`)
  }
}

// ---------------------------------------------------------------------------
// CSV — parsed via ExcelJS csv reader
// ---------------------------------------------------------------------------
async function parseCSV(buffer: Buffer): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook()
  const stream = Readable.from(buffer)
  await workbook.csv.read(stream)

  const worksheet = workbook.worksheets[0]
  if (!worksheet || worksheet.rowCount < 2) {
    throw new Error("CSV file has no data rows. Ensure the first row contains column headers.")
  }

  return extractFromWorksheet(worksheet)
}

// ---------------------------------------------------------------------------
// Excel (.xlsx/.xls)
// ---------------------------------------------------------------------------
async function parseExcel(buffer: Buffer): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as any)

  const worksheet = workbook.worksheets[0]
  if (!worksheet || worksheet.rowCount < 2) {
    throw new Error("Excel file has no data rows. Ensure the first row contains column headers.")
  }

  return extractFromWorksheet(worksheet)
}

// ---------------------------------------------------------------------------
// Shared ExcelJS worksheet extractor
// ---------------------------------------------------------------------------
function extractFromWorksheet(worksheet: ExcelJS.Worksheet): ParseResult {
  const columns: string[] = []
  const rows: Record<string, string>[] = []

  // Row 1 = headers
  const headerRow = worksheet.getRow(1)
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const val = cellToString(cell)
    columns[colNumber - 1] = val || `Column_${colNumber}`
  })

  if (columns.length === 0) {
    throw new Error("No column headers found in the first row.")
  }

  // Data rows (2 onwards)
  for (let r = 2; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r)
    const record: Record<string, string> = {}
    let hasData = false

    columns.forEach((col, idx) => {
      const cell = row.getCell(idx + 1)
      const val = cellToString(cell)
      record[col] = val
      if (val) hasData = true
    })

    if (hasData) rows.push(record)
  }

  return { columns, rows, totalRows: rows.length }
}

function cellToString(cell: ExcelJS.Cell): string {
  if (cell.value === null || cell.value === undefined) return ""
  if (cell.value instanceof Date) {
    // Format as YYYY-MM-DD
    return cell.value.toISOString().split("T")[0]
  }
  if (typeof cell.value === "object" && "text" in cell.value) {
    return (cell.value as any).text || ""
  }
  if (typeof cell.value === "object" && "result" in cell.value) {
    return String((cell.value as any).result ?? "")
  }
  return String(cell.value)
}

// ---------------------------------------------------------------------------
// PDF — extract text and detect tabular structure
// ---------------------------------------------------------------------------
async function parsePDF(buffer: Buffer): Promise<ParseResult> {
  // pdf-parse is CommonJS, use dynamic import
  const pdfModule = await import("pdf-parse")
  const pdfParse = (pdfModule as any).default || pdfModule
  const data = await pdfParse(buffer)
  const text = data.text

  if (!text || text.trim().length < 10) {
    throw new Error("Could not extract text from PDF. The file may be image-based. Please use CSV or Excel instead.")
  }

  const lines = text
    .split("\n")
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 0)

  if (lines.length < 2) {
    throw new Error("PDF contains too few lines to detect tabular data. Please use CSV or Excel.")
  }

  // Detect delimiter: try tab, then pipe, then multiple spaces
  let delimiter: string | RegExp = "\t"
  const firstLine = lines[0]

  if (firstLine.includes("\t")) {
    delimiter = "\t"
  } else if (firstLine.includes("|")) {
    delimiter = "|"
  } else if (/\s{2,}/.test(firstLine)) {
    delimiter = /\s{2,}/
  } else if (firstLine.includes(",")) {
    delimiter = ","
  } else {
    throw new Error(
      "Could not detect a table structure in this PDF. Column delimiters (tab, pipe, comma) not found. Please convert to CSV or Excel for reliable import."
    )
  }

  const splitLine = (line: string): string[] => {
    if (typeof delimiter === "string") {
      return line.split(delimiter).map((s) => s.trim())
    }
    return line.split(delimiter).map((s) => s.trim())
  }

  // Headers from first line
  const columns = splitLine(firstLine).filter(Boolean)
  if (columns.length < 2) {
    throw new Error("Could not detect enough columns in the PDF. Please use CSV or Excel.")
  }

  // Data rows
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const parts = splitLine(lines[i])
    // Skip lines that don't have roughly the right number of columns
    if (parts.length < Math.max(2, columns.length - 2)) continue

    const record: Record<string, string> = {}
    let hasData = false
    columns.forEach((col, idx) => {
      record[col] = parts[idx] || ""
      if (parts[idx]) hasData = true
    })
    if (hasData) rows.push(record)
  }

  if (rows.length === 0) {
    throw new Error("PDF table detected but no data rows found. Please use CSV or Excel.")
  }

  return { columns, rows, totalRows: rows.length }
}
