import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { prisma } from "@/lib/prisma"
import { parseFile } from "@/lib/import/parsers"
import { ENTITY_SCHEMAS, coerceValue } from "@/lib/import/schema-definitions"
import bcrypt from "bcryptjs"

export async function POST(req: NextRequest) {
  const { error, session, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error || !hospitalId) return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { jobId, mapping, editedRows, skipErrorRows = false } = await req.json()
    if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 })
    if (!mapping) return NextResponse.json({ error: "mapping is required" }, { status: 400 })

    // Load job
    const job = await prisma.dataImportJob.findFirst({
      where: { id: jobId, hospitalId },
    })
    if (!job) return NextResponse.json({ error: "Import job not found" }, { status: 404 })

    // Mark signoff
    await prisma.dataImportJob.update({
      where: { id: jobId },
      data: { signedOffAt: new Date(), status: "IMPORTING" },
    })

    // Re-parse full file
    const filePath = path.join(process.cwd(), job.filePath)
    const buffer = await readFile(filePath)
    const parsed = await parseFile(buffer, job.fileType)

    const schema = ENTITY_SCHEMAS[job.entityType]

    // Build reverse mapping
    const reverseMap: Record<string, string> = {}
    for (const [sourceCol, targetField] of Object.entries(mapping)) {
      if (targetField) reverseMap[targetField as string] = sourceCol
    }

    // Transform all rows
    const transformedRows: Record<string, any>[] = []
    for (let i = 0; i < parsed.rows.length; i++) {
      const sourceRow = parsed.rows[i]
      const edits = editedRows?.[i]
      const row: Record<string, any> = { _rowNum: i + 1 }

      for (const field of schema.fields) {
        const sourceCol = reverseMap[field.name]
        let rawValue = ""
        if (edits && edits[field.name] !== undefined) {
          rawValue = edits[field.name]
        } else if (sourceCol && sourceRow[sourceCol] !== undefined) {
          rawValue = sourceRow[sourceCol]
        }
        const { value } = coerceValue(rawValue, field)
        row[field.name] = value
      }
      transformedRows.push(row)
    }

    // Import based on entity type
    let successCount = 0
    let errorCount = 0
    const importErrors: { row: number; message: string }[] = []

    try {
      switch (job.entityType) {
        case "patients":
          ({ successCount, errorCount } = await importPatients(hospitalId, transformedRows, skipErrorRows, importErrors))
          break
        case "staff":
          ({ successCount, errorCount } = await importStaff(hospitalId, transformedRows, skipErrorRows, importErrors))
          break
        case "appointments":
          ({ successCount, errorCount } = await importAppointments(hospitalId, transformedRows, skipErrorRows, importErrors))
          break
        case "treatments":
          ({ successCount, errorCount } = await importTreatments(hospitalId, transformedRows, skipErrorRows, importErrors))
          break
        case "invoices":
          ({ successCount, errorCount } = await importInvoices(hospitalId, transformedRows, skipErrorRows, importErrors))
          break
        case "payments":
          ({ successCount, errorCount } = await importPayments(hospitalId, transformedRows, skipErrorRows, importErrors))
          break
        case "inventory":
          ({ successCount, errorCount } = await importInventory(hospitalId, transformedRows, skipErrorRows, importErrors))
          break
      }
    } catch (batchErr: any) {
      await prisma.dataImportJob.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          errorLog: batchErr.message,
          successCount,
          errorCount,
        },
      })
      return NextResponse.json({
        success: false,
        jobId,
        totalRows: parsed.totalRows,
        imported: successCount,
        skipped: errorCount,
        errors: [{ row: 0, message: batchErr.message }],
      })
    }

    // Update job as completed
    await prisma.dataImportJob.update({
      where: { id: jobId },
      data: {
        status: errorCount > 0 && successCount === 0 ? "FAILED" : "COMPLETED",
        completedAt: new Date(),
        successCount,
        errorCount,
        errorLog: importErrors.length > 0 ? JSON.stringify(importErrors) : null,
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        hospitalId,
        userId: session!.user.id,
        action: "DATA_IMPORT",
        entityType: job.entityType,
        entityId: jobId,
        newValues: JSON.stringify({
          fileName: job.fileName,
          entityType: job.entityType,
          totalRows: parsed.totalRows,
          imported: successCount,
          skipped: errorCount,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      jobId,
      totalRows: parsed.totalRows,
      imported: successCount,
      skipped: errorCount,
      errors: importErrors.slice(0, 50),
    })
  } catch (err: any) {
    console.error("Data import commit error:", err)
    return NextResponse.json({ error: err.message || "Import failed" }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// ID generation helpers (following existing patterns in the codebase)
// ---------------------------------------------------------------------------
async function generateId(hospitalId: string, model: string, prefix: string, field: string): Promise<string> {
  const year = new Date().getFullYear()
  const idPrefix = `${prefix}${year}`

  const existing = await (prisma as any)[model].findFirst({
    where: { hospitalId, [field]: { startsWith: idPrefix } },
    orderBy: { [field]: "desc" },
    select: { [field]: true },
  })

  if (existing) {
    const lastNum = parseInt(existing[field].replace(idPrefix, ""), 10) || 0
    return `${idPrefix}${String(lastNum + 1).padStart(5, "0")}`
  }
  return `${idPrefix}00001`
}

// ---------------------------------------------------------------------------
// Entity-specific import functions
// ---------------------------------------------------------------------------

async function importPatients(
  hospitalId: string,
  rows: Record<string, any>[],
  skipErrors: boolean,
  errors: { row: number; message: string }[]
) {
  let successCount = 0, errorCount = 0

  for (const row of rows) {
    try {
      const patientId = row.patientId || await generateId(hospitalId, "patient", "PAT", "patientId")

      // Handle name splitting: if firstName contains space and no lastName, split it
      let firstName = row.firstName || ""
      let lastName = row.lastName || ""
      if (firstName && !lastName && firstName.includes(" ")) {
        const parts = firstName.split(" ")
        firstName = parts[0]
        lastName = parts.slice(1).join(" ")
      }

      if (!firstName || !row.phone) {
        if (skipErrors) { errorCount++; errors.push({ row: row._rowNum, message: "Missing required: firstName or phone" }); continue }
        throw new Error(`Row ${row._rowNum}: Missing firstName or phone`)
      }

      await prisma.patient.create({
        data: {
          hospitalId,
          patientId,
          firstName,
          lastName: lastName || ".",
          phone: row.phone,
          email: row.email || undefined,
          dateOfBirth: row.dateOfBirth || undefined,
          age: row.age || undefined,
          gender: row.gender || undefined,
          bloodGroup: row.bloodGroup || undefined,
          address: row.address || undefined,
          city: row.city || undefined,
          state: row.state || undefined,
          pincode: row.pincode || undefined,
          occupation: row.occupation || undefined,
          referredBy: row.referredBy || undefined,
          alternatePhone: row.alternatePhone || undefined,
          aadharNumber: row.aadharNumber || undefined,
          emergencyContactName: row.emergencyContactName || undefined,
          emergencyContactPhone: row.emergencyContactPhone || undefined,
          emergencyContactRelation: row.emergencyContactRelation || undefined,
        },
      })
      successCount++
    } catch (err: any) {
      if (skipErrors) {
        errorCount++
        errors.push({ row: row._rowNum, message: err.message })
      } else {
        throw err
      }
    }
  }
  return { successCount, errorCount }
}

async function importStaff(
  hospitalId: string,
  rows: Record<string, any>[],
  skipErrors: boolean,
  errors: { row: number; message: string }[]
) {
  let successCount = 0, errorCount = 0

  for (const row of rows) {
    try {
      let firstName = row.firstName || ""
      let lastName = row.lastName || ""
      if (firstName && !lastName && firstName.includes(" ")) {
        const parts = firstName.split(" ")
        firstName = parts[0]
        lastName = parts.slice(1).join(" ")
      }

      if (!firstName || !row.email || !row.phone) {
        if (skipErrors) { errorCount++; errors.push({ row: row._rowNum, message: "Missing required: firstName, email, or phone" }); continue }
        throw new Error(`Row ${row._rowNum}: Missing firstName, email, or phone`)
      }

      // Check if email already exists
      const existingUser = await prisma.user.findUnique({ where: { email: row.email } })
      if (existingUser) {
        if (skipErrors) { errorCount++; errors.push({ row: row._rowNum, message: `Email ${row.email} already exists` }); continue }
        throw new Error(`Row ${row._rowNum}: Email ${row.email} already exists`)
      }

      const employeeId = row.employeeId || await generateId(hospitalId, "staff", "EMP", "employeeId")
      const tempPassword = crypto.randomUUID().slice(0, 12)
      const hashedPassword = await bcrypt.hash(tempPassword, 10)

      // Determine role
      const roleMap: Record<string, string> = {
        DOCTOR: "DOCTOR", RECEPTIONIST: "RECEPTIONIST", NURSE: "NURSE",
        LAB_TECH: "LAB_TECH", ADMIN: "ADMIN",
        Doctor: "DOCTOR", Receptionist: "RECEPTIONIST", Nurse: "NURSE",
        doctor: "DOCTOR", receptionist: "RECEPTIONIST", nurse: "NURSE",
      }
      const role = roleMap[row.role] || "RECEPTIONIST"

      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            hospitalId,
            email: row.email,
            name: `${firstName} ${lastName}`.trim(),
            phone: row.phone,
            password: hashedPassword,
            role: role as any,
            mustChangePassword: true,
          },
        })

        await tx.staff.create({
          data: {
            hospitalId,
            userId: user.id,
            employeeId,
            firstName,
            lastName: lastName || ".",
            phone: row.phone,
            email: row.email,
            dateOfBirth: row.dateOfBirth || undefined,
            gender: row.gender || undefined,
            qualification: row.qualification || undefined,
            specialization: row.specialization || undefined,
            licenseNumber: row.licenseNumber || undefined,
            joiningDate: row.joiningDate || undefined,
            salary: row.salary || undefined,
            address: row.address || undefined,
            city: row.city || undefined,
            state: row.state || undefined,
            pincode: row.pincode || undefined,
            aadharNumber: row.aadharNumber || undefined,
            panNumber: row.panNumber || undefined,
          },
        })
      })
      successCount++
    } catch (err: any) {
      if (skipErrors) {
        errorCount++
        errors.push({ row: row._rowNum, message: err.message })
      } else {
        throw err
      }
    }
  }
  return { successCount, errorCount }
}

async function importAppointments(
  hospitalId: string,
  rows: Record<string, any>[],
  skipErrors: boolean,
  errors: { row: number; message: string }[]
) {
  let successCount = 0, errorCount = 0

  // Pre-load lookups
  const patients = await prisma.patient.findMany({
    where: { hospitalId },
    select: { id: true, patientId: true, phone: true, firstName: true, lastName: true },
  })
  const patientLookup = new Map<string, string>()
  patients.forEach((p) => {
    patientLookup.set(p.patientId, p.id)
    patientLookup.set(p.phone, p.id)
    patientLookup.set(`${p.firstName} ${p.lastName}`.toLowerCase(), p.id)
  })

  const staff = await prisma.staff.findMany({
    where: { hospitalId },
    select: { id: true, employeeId: true, firstName: true, lastName: true },
  })
  const staffLookup = new Map<string, string>()
  staff.forEach((s) => {
    staffLookup.set(s.employeeId, s.id)
    staffLookup.set(`${s.firstName} ${s.lastName}`.toLowerCase(), s.id)
    staffLookup.set(s.firstName.toLowerCase(), s.id)
  })

  for (const row of rows) {
    try {
      const patientId = patientLookup.get(row.patientRef) || patientLookup.get(row.patientRef?.toLowerCase?.())
      if (!patientId) {
        if (skipErrors) { errorCount++; errors.push({ row: row._rowNum, message: `Patient "${row.patientRef}" not found` }); continue }
        throw new Error(`Row ${row._rowNum}: Patient "${row.patientRef}" not found`)
      }

      const doctorId = staffLookup.get(row.doctorRef) || staffLookup.get(row.doctorRef?.toLowerCase?.())
      if (!doctorId) {
        if (skipErrors) { errorCount++; errors.push({ row: row._rowNum, message: `Doctor "${row.doctorRef}" not found` }); continue }
        throw new Error(`Row ${row._rowNum}: Doctor "${row.doctorRef}" not found`)
      }

      if (!row.scheduledDate || !row.scheduledTime) {
        if (skipErrors) { errorCount++; errors.push({ row: row._rowNum, message: "Missing scheduledDate or scheduledTime" }); continue }
        throw new Error(`Row ${row._rowNum}: Missing scheduledDate or scheduledTime`)
      }

      const appointmentNo = row.appointmentNo || await generateId(hospitalId, "appointment", "APT", "appointmentNo")

      await prisma.appointment.create({
        data: {
          hospitalId,
          appointmentNo,
          patientId,
          doctorId,
          scheduledDate: row.scheduledDate,
          scheduledTime: row.scheduledTime,
          duration: row.duration || 30,
          appointmentType: row.appointmentType || undefined,
          status: row.status || "COMPLETED",
          chiefComplaint: row.chiefComplaint || undefined,
          notes: row.notes || undefined,
          chairNumber: row.chairNumber || undefined,
        },
      })
      successCount++
    } catch (err: any) {
      if (skipErrors) {
        errorCount++
        errors.push({ row: row._rowNum, message: err.message })
      } else {
        throw err
      }
    }
  }
  return { successCount, errorCount }
}

async function importTreatments(
  hospitalId: string,
  rows: Record<string, any>[],
  skipErrors: boolean,
  errors: { row: number; message: string }[]
) {
  let successCount = 0, errorCount = 0

  // Pre-load lookups
  const patients = await prisma.patient.findMany({
    where: { hospitalId },
    select: { id: true, patientId: true, phone: true, firstName: true, lastName: true },
  })
  const patientLookup = new Map<string, string>()
  patients.forEach((p) => {
    patientLookup.set(p.patientId, p.id)
    patientLookup.set(p.phone, p.id)
    patientLookup.set(`${p.firstName} ${p.lastName}`.toLowerCase(), p.id)
  })

  const staffList = await prisma.staff.findMany({
    where: { hospitalId },
    select: { id: true, employeeId: true, firstName: true, lastName: true },
  })
  const staffLookup = new Map<string, string>()
  staffList.forEach((s) => {
    staffLookup.set(s.employeeId, s.id)
    staffLookup.set(`${s.firstName} ${s.lastName}`.toLowerCase(), s.id)
    staffLookup.set(s.firstName.toLowerCase(), s.id)
  })

  const procedures = await prisma.procedure.findMany({
    where: { hospitalId },
    select: { id: true, name: true, code: true },
  })
  const procLookup = new Map<string, string>()
  procedures.forEach((p) => {
    procLookup.set(p.name.toLowerCase(), p.id)
    if (p.code) procLookup.set(p.code.toLowerCase(), p.id)
  })

  for (const row of rows) {
    try {
      const patientId = patientLookup.get(row.patientRef) || patientLookup.get(row.patientRef?.toLowerCase?.())
      if (!patientId) {
        if (skipErrors) { errorCount++; errors.push({ row: row._rowNum, message: `Patient "${row.patientRef}" not found` }); continue }
        throw new Error(`Row ${row._rowNum}: Patient not found`)
      }

      const doctorId = staffLookup.get(row.doctorRef) || staffLookup.get(row.doctorRef?.toLowerCase?.())
      if (!doctorId) {
        if (skipErrors) { errorCount++; errors.push({ row: row._rowNum, message: `Doctor "${row.doctorRef}" not found` }); continue }
        throw new Error(`Row ${row._rowNum}: Doctor not found`)
      }

      const procedureId = procLookup.get(row.procedureRef?.toLowerCase?.())
      if (!procedureId) {
        if (skipErrors) { errorCount++; errors.push({ row: row._rowNum, message: `Procedure "${row.procedureRef}" not found` }); continue }
        throw new Error(`Row ${row._rowNum}: Procedure not found`)
      }

      if (row.cost === null || row.cost === undefined) {
        if (skipErrors) { errorCount++; errors.push({ row: row._rowNum, message: "Cost is required" }); continue }
        throw new Error(`Row ${row._rowNum}: Cost is required`)
      }

      const treatmentNo = row.treatmentNo || await generateId(hospitalId, "treatment", "TRT", "treatmentNo")

      await prisma.treatment.create({
        data: {
          hospitalId,
          treatmentNo,
          patientId,
          doctorId,
          procedureId,
          cost: row.cost,
          toothNumbers: row.toothNumbers || undefined,
          diagnosis: row.diagnosis || undefined,
          findings: row.findings || undefined,
          procedureNotes: row.procedureNotes || undefined,
          status: row.status || "COMPLETED",
          startTime: row.startTime || undefined,
          endTime: row.endTime || undefined,
        },
      })
      successCount++
    } catch (err: any) {
      if (skipErrors) {
        errorCount++
        errors.push({ row: row._rowNum, message: err.message })
      } else {
        throw err
      }
    }
  }
  return { successCount, errorCount }
}

async function importInvoices(
  hospitalId: string,
  rows: Record<string, any>[],
  skipErrors: boolean,
  errors: { row: number; message: string }[]
) {
  let successCount = 0, errorCount = 0

  const patients = await prisma.patient.findMany({
    where: { hospitalId },
    select: { id: true, patientId: true, phone: true, firstName: true, lastName: true },
  })
  const patientLookup = new Map<string, string>()
  patients.forEach((p) => {
    patientLookup.set(p.patientId, p.id)
    patientLookup.set(p.phone, p.id)
    patientLookup.set(`${p.firstName} ${p.lastName}`.toLowerCase(), p.id)
  })

  for (const row of rows) {
    try {
      const patientId = patientLookup.get(row.patientRef) || patientLookup.get(row.patientRef?.toLowerCase?.())
      if (!patientId) {
        if (skipErrors) { errorCount++; errors.push({ row: row._rowNum, message: `Patient "${row.patientRef}" not found` }); continue }
        throw new Error(`Row ${row._rowNum}: Patient not found`)
      }

      const invoiceNo = row.invoiceNo || await generateId(hospitalId, "invoice", "INV", "invoiceNo")
      const subtotal = row.subtotal ?? 0
      const totalAmount = row.totalAmount ?? subtotal
      const paidAmount = row.paidAmount ?? 0
      const balanceAmount = row.balanceAmount ?? (totalAmount - paidAmount)
      const taxableAmount = row.taxableAmount ?? subtotal
      const cgstAmount = row.cgstAmount ?? 0
      const sgstAmount = row.sgstAmount ?? 0

      await prisma.invoice.create({
        data: {
          hospitalId,
          invoiceNo,
          patientId,
          subtotal,
          totalAmount,
          paidAmount,
          balanceAmount,
          taxableAmount,
          cgstAmount,
          sgstAmount,
          discountAmount: row.discountAmount || 0,
          status: row.status || (paidAmount >= totalAmount ? "PAID" : paidAmount > 0 ? "PARTIALLY_PAID" : "PENDING"),
          dueDate: row.dueDate || undefined,
          notes: row.notes || undefined,
        },
      })
      successCount++
    } catch (err: any) {
      if (skipErrors) {
        errorCount++
        errors.push({ row: row._rowNum, message: err.message })
      } else {
        throw err
      }
    }
  }
  return { successCount, errorCount }
}

async function importPayments(
  hospitalId: string,
  rows: Record<string, any>[],
  skipErrors: boolean,
  errors: { row: number; message: string }[]
) {
  let successCount = 0, errorCount = 0

  const invoices = await prisma.invoice.findMany({
    where: { hospitalId },
    select: { id: true, invoiceNo: true },
  })
  const invoiceLookup = new Map<string, string>()
  invoices.forEach((inv) => {
    invoiceLookup.set(inv.invoiceNo, inv.id)
    invoiceLookup.set(inv.invoiceNo.toLowerCase(), inv.id)
  })

  for (const row of rows) {
    try {
      const invoiceId = invoiceLookup.get(row.invoiceRef) || invoiceLookup.get(row.invoiceRef?.toLowerCase?.())
      if (!invoiceId) {
        if (skipErrors) { errorCount++; errors.push({ row: row._rowNum, message: `Invoice "${row.invoiceRef}" not found` }); continue }
        throw new Error(`Row ${row._rowNum}: Invoice not found`)
      }

      if (!row.amount || !row.paymentMethod) {
        if (skipErrors) { errorCount++; errors.push({ row: row._rowNum, message: "Amount and paymentMethod are required" }); continue }
        throw new Error(`Row ${row._rowNum}: Amount and paymentMethod are required`)
      }

      const paymentNo = row.paymentNo || await generateId(hospitalId, "payment", "PAY", "paymentNo")

      await prisma.payment.create({
        data: {
          hospitalId,
          paymentNo,
          invoiceId,
          amount: row.amount,
          paymentMethod: row.paymentMethod,
          paymentDate: row.paymentDate || new Date(),
          transactionId: row.transactionId || undefined,
          bankName: row.bankName || undefined,
          chequeNumber: row.chequeNumber || undefined,
          upiId: row.upiId || undefined,
          status: row.status || "COMPLETED",
          notes: row.notes || undefined,
        },
      })
      successCount++
    } catch (err: any) {
      if (skipErrors) {
        errorCount++
        errors.push({ row: row._rowNum, message: err.message })
      } else {
        throw err
      }
    }
  }
  return { successCount, errorCount }
}

async function importInventory(
  hospitalId: string,
  rows: Record<string, any>[],
  skipErrors: boolean,
  errors: { row: number; message: string }[]
) {
  let successCount = 0, errorCount = 0

  for (const row of rows) {
    try {
      if (!row.name || !row.unit || row.purchasePrice === null || row.purchasePrice === undefined) {
        if (skipErrors) { errorCount++; errors.push({ row: row._rowNum, message: "name, unit, and purchasePrice are required" }); continue }
        throw new Error(`Row ${row._rowNum}: name, unit, and purchasePrice are required`)
      }

      const sku = row.sku || await generateId(hospitalId, "inventoryItem", "SKU", "sku")

      // Check for duplicate SKU
      const existing = await prisma.inventoryItem.findFirst({
        where: { hospitalId, sku },
      })
      if (existing) {
        if (skipErrors) { errorCount++; errors.push({ row: row._rowNum, message: `SKU "${sku}" already exists` }); continue }
        throw new Error(`Row ${row._rowNum}: SKU "${sku}" already exists`)
      }

      await prisma.inventoryItem.create({
        data: {
          hospitalId,
          sku,
          name: row.name,
          unit: row.unit,
          purchasePrice: row.purchasePrice,
          sellingPrice: row.sellingPrice || undefined,
          currentStock: row.currentStock ?? 0,
          minimumStock: row.minimumStock ?? 10,
          reorderLevel: row.reorderLevel ?? 20,
          manufacturer: row.manufacturer || undefined,
          description: row.description || undefined,
          storageLocation: row.storageLocation || undefined,
          storageConditions: row.storageConditions || undefined,
        },
      })
      successCount++
    } catch (err: any) {
      if (skipErrors) {
        errorCount++
        errors.push({ row: row._rowNum, message: err.message })
      } else {
        throw err
      }
    }
  }
  return { successCount, errorCount }
}
