import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { prisma } from "@/lib/prisma"
import { parseFile } from "@/lib/import/parsers"
import { ENTITY_SCHEMAS, coerceValue } from "@/lib/import/schema-definitions"
import type { FieldDefinition } from "@/lib/import/schema-definitions"

interface ValidationError {
  row: number
  field: string
  value: string
  message: string
  severity: "error" | "warning"
}

export async function POST(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error || !hospitalId) return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { jobId, mapping, editedRows } = await req.json()
    if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 })
    if (!mapping) return NextResponse.json({ error: "mapping is required" }, { status: 400 })

    // Load job
    const job = await prisma.dataImportJob.findFirst({
      where: { id: jobId, hospitalId },
    })
    if (!job) return NextResponse.json({ error: "Import job not found" }, { status: 404 })

    const schema = ENTITY_SCHEMAS[job.entityType]
    if (!schema) return NextResponse.json({ error: "Invalid entity type" }, { status: 400 })

    // Re-parse the full file
    const filePath = path.join(process.cwd(), job.filePath)
    const buffer = await readFile(filePath)
    const parsed = await parseFile(buffer, job.fileType)

    // Build reverse mapping: targetField -> sourceColumn
    const reverseMap: Record<string, string> = {}
    for (const [sourceCol, targetField] of Object.entries(mapping)) {
      if (targetField) reverseMap[targetField as string] = sourceCol
    }

    // Validate each row
    const errors: ValidationError[] = []
    const transformedPreview: Record<string, any>[] = []

    for (let i = 0; i < parsed.rows.length; i++) {
      const sourceRow = parsed.rows[i]
      // Apply edits if any
      const edits = editedRows?.[i]
      const transformedRow: Record<string, any> = { _rowNum: i + 1 }

      for (const field of schema.fields) {
        const sourceCol = reverseMap[field.name]
        let rawValue = ""

        if (edits && edits[field.name] !== undefined) {
          // User edited this cell
          rawValue = edits[field.name]
        } else if (sourceCol && sourceRow[sourceCol] !== undefined) {
          rawValue = sourceRow[sourceCol]
        }

        const { value, error: coerceError } = coerceValue(rawValue, field)
        transformedRow[field.name] = value

        if (coerceError) {
          errors.push({
            row: i + 1,
            field: field.name,
            value: rawValue,
            message: coerceError,
            severity: field.required && !value ? "error" : "warning",
          })
        }
      }

      if (i < 20) transformedPreview.push(transformedRow)
    }

    // Check for duplicates against existing DB records
    const duplicateWarnings = await checkDuplicates(hospitalId, schema, parsed.rows, reverseMap)
    errors.push(...duplicateWarnings)

    // Check FK resolution for entities that need it
    let fkReport = { resolved: 0, unresolved: [] as { row: number; field: string; value: string }[] }
    if (["appointments", "treatments", "invoices", "payments"].includes(job.entityType)) {
      fkReport = await checkForeignKeys(hospitalId, schema, parsed.rows, reverseMap)
    }

    const errorCount = errors.filter((e) => e.severity === "error").length
    const warningCount = errors.filter((e) => e.severity === "warning").length
    const valid = errorCount === 0

    // Update job status
    await prisma.dataImportJob.update({
      where: { id: jobId },
      data: {
        columnMapping: mapping,
        validationErrors: errors.length > 0 ? (errors as any) : undefined,
        status: valid ? "VALIDATED" : "MAPPED",
      },
    })

    return NextResponse.json({
      valid,
      totalRows: parsed.totalRows,
      validRows: parsed.totalRows - errorCount,
      errorCount,
      warningCount,
      errors: errors.slice(0, 200), // Cap at 200 errors to avoid huge payloads
      transformedPreview,
      foreignKeyResolution: fkReport,
    })
  } catch (err: any) {
    console.error("Validation error:", err)
    return NextResponse.json({ error: err.message || "Validation failed" }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Duplicate checking
// ---------------------------------------------------------------------------
async function checkDuplicates(
  hospitalId: string,
  schema: typeof ENTITY_SCHEMAS[string],
  rows: Record<string, string>[],
  reverseMap: Record<string, string>
): Promise<ValidationError[]> {
  const warnings: ValidationError[] = []

  // Only check entities with phone/email/sku uniqueness
  if (schema.entityType === "patients") {
    const phoneCol = reverseMap["phone"]
    if (phoneCol) {
      const phones = rows.map((r) => r[phoneCol]).filter(Boolean)
      if (phones.length > 0) {
        const existing = await prisma.patient.findMany({
          where: { hospitalId, phone: { in: phones } },
          select: { phone: true, patientId: true },
        })
        const existingMap = new Map(existing.map((p) => [p.phone, p.patientId]))
        rows.forEach((r, i) => {
          const phone = r[phoneCol]
          if (phone && existingMap.has(phone)) {
            warnings.push({
              row: i + 1,
              field: "phone",
              value: phone,
              message: `Possible duplicate: patient ${existingMap.get(phone)} has same phone`,
              severity: "warning",
            })
          }
        })
      }
    }
  }

  if (schema.entityType === "inventory") {
    const skuCol = reverseMap["sku"]
    if (skuCol) {
      const skus = rows.map((r) => r[skuCol]).filter(Boolean)
      if (skus.length > 0) {
        const existing = await prisma.inventoryItem.findMany({
          where: { hospitalId, sku: { in: skus } },
          select: { sku: true },
        })
        const existingSkus = new Set(existing.map((i) => i.sku))
        rows.forEach((r, i) => {
          if (r[skuCol] && existingSkus.has(r[skuCol])) {
            warnings.push({
              row: i + 1,
              field: "sku",
              value: r[skuCol],
              message: `SKU "${r[skuCol]}" already exists and will be skipped`,
              severity: "warning",
            })
          }
        })
      }
    }
  }

  if (schema.entityType === "staff") {
    const emailCol = reverseMap["email"]
    if (emailCol) {
      const emails = rows.map((r) => r[emailCol]).filter(Boolean)
      if (emails.length > 0) {
        const existing = await prisma.user.findMany({
          where: { email: { in: emails } },
          select: { email: true },
        })
        const existingEmails = new Set(existing.map((u) => u.email))
        rows.forEach((r, i) => {
          if (r[emailCol] && existingEmails.has(r[emailCol])) {
            warnings.push({
              row: i + 1,
              field: "email",
              value: r[emailCol],
              message: `Email "${r[emailCol]}" already exists. Staff record will be skipped.`,
              severity: "error",
            })
          }
        })
      }
    }
  }

  return warnings
}

// ---------------------------------------------------------------------------
// Foreign key resolution check
// ---------------------------------------------------------------------------
async function checkForeignKeys(
  hospitalId: string,
  schema: typeof ENTITY_SCHEMAS[string],
  rows: Record<string, string>[],
  reverseMap: Record<string, string>
): Promise<{ resolved: number; unresolved: { row: number; field: string; value: string }[] }> {
  let resolved = 0
  const unresolved: { row: number; field: string; value: string }[] = []

  const fkFields = schema.fields.filter((f) => f.foreignKey)
  if (fkFields.length === 0) return { resolved, unresolved }

  // Pre-load lookup data
  const lookups: Record<string, Map<string, string>> = {}

  for (const field of fkFields) {
    if (!field.foreignKey) continue
    const model = field.foreignKey.model

    if (model === "Patient") {
      const patients = await prisma.patient.findMany({
        where: { hospitalId },
        select: { id: true, patientId: true, phone: true, firstName: true, lastName: true },
      })
      const map = new Map<string, string>()
      patients.forEach((p) => {
        map.set(p.patientId, p.id)
        map.set(p.phone, p.id)
        map.set(`${p.firstName} ${p.lastName}`.toLowerCase(), p.id)
        map.set(p.firstName.toLowerCase(), p.id)
      })
      lookups[field.name] = map
    } else if (model === "Staff") {
      const staff = await prisma.staff.findMany({
        where: { hospitalId },
        select: { id: true, employeeId: true, firstName: true, lastName: true },
      })
      const map = new Map<string, string>()
      staff.forEach((s) => {
        map.set(s.employeeId, s.id)
        map.set(`${s.firstName} ${s.lastName}`.toLowerCase(), s.id)
        map.set(s.firstName.toLowerCase(), s.id)
      })
      lookups[field.name] = map
    } else if (model === "Procedure") {
      const procedures = await prisma.procedure.findMany({
        where: { hospitalId },
        select: { id: true, name: true, code: true },
      })
      const map = new Map<string, string>()
      procedures.forEach((p) => {
        map.set(p.name.toLowerCase(), p.id)
        if (p.code) map.set(p.code.toLowerCase(), p.id)
      })
      lookups[field.name] = map
    } else if (model === "Invoice") {
      const invoices = await prisma.invoice.findMany({
        where: { hospitalId },
        select: { id: true, invoiceNo: true },
      })
      const map = new Map<string, string>()
      invoices.forEach((inv) => {
        map.set(inv.invoiceNo, inv.id)
        map.set(inv.invoiceNo.toLowerCase(), inv.id)
      })
      lookups[field.name] = map
    }
  }

  // Check each row
  for (let i = 0; i < rows.length; i++) {
    for (const field of fkFields) {
      const sourceCol = reverseMap[field.name]
      if (!sourceCol) continue
      const value = rows[i][sourceCol]?.trim()
      if (!value) continue

      const lookup = lookups[field.name]
      if (!lookup) continue

      const found = lookup.get(value) || lookup.get(value.toLowerCase())
      if (found) {
        resolved++
      } else {
        unresolved.push({ row: i + 1, field: field.name, value })
      }
    }
  }

  return { resolved, unresolved: unresolved.slice(0, 100) }
}
