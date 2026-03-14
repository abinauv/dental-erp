/**
 * Shared command executor functions.
 * Used by both the /api/ai/command route (single-shot) and
 * the /api/ai/chat route (conversational action execution).
 */

import { prisma } from "@/lib/prisma"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Find a patient by name, ID, or phone */
async function findPatient(hospitalId: string, query: string) {
  return prisma.patient.findFirst({
    where: {
      hospitalId,
      OR: [
        { patientId: query },
        { firstName: { contains: query } },
        { lastName: { contains: query } },
        { phone: { contains: query } },
      ],
    },
  })
}

/** Find a staff/doctor by name */
async function findDoctor(hospitalId: string, name?: string) {
  if (name) {
    return prisma.staff.findFirst({
      where: {
        hospitalId,
        isActive: true,
        OR: [
          { firstName: { contains: name } },
          { lastName: { contains: name } },
        ],
      },
    })
  }
  return prisma.staff.findFirst({ where: { hospitalId, isActive: true } })
}

/** Generate sequential number like APT-00001 */
async function nextNumber(hospitalId: string, model: string, prefix: string) {
  const count = await (prisma as any)[model].count({ where: { hospitalId } })
  return `${prefix}-${String(count + 1).padStart(5, "0")}`
}

// ---------------------------------------------------------------------------
// 1. PATIENT MANAGEMENT
// ---------------------------------------------------------------------------

export async function execCreatePatient(params: Record<string, string>, hospitalId: string) {
  if (!params.firstName || !params.lastName) {
    return { success: false, message: "First name and last name are required to create a patient." }
  }
  if (!params.phone) {
    return { success: false, message: "Phone number is required to create a patient." }
  }

  // Check for duplicates
  const existing = await prisma.patient.findFirst({
    where: {
      hospitalId,
      firstName: { contains: params.firstName },
      lastName: { contains: params.lastName },
      phone: params.phone,
    },
  })
  if (existing) {
    return { success: false, message: `A patient named ${existing.firstName} ${existing.lastName} with phone ${existing.phone} already exists (ID: ${existing.patientId}).` }
  }

  const patientId = await nextNumber(hospitalId, "patient", "PAT")

  const patient = await prisma.patient.create({
    data: {
      hospitalId,
      patientId,
      firstName: params.firstName,
      lastName: params.lastName,
      phone: params.phone,
      age: params.age ? parseInt(params.age) : undefined,
      gender: (params.gender as any) || undefined,
      email: params.email || undefined,
      address: params.address || undefined,
      city: params.city || undefined,
      bloodGroup: (params.bloodGroup as any) || undefined,
      dateOfBirth: params.dateOfBirth ? new Date(params.dateOfBirth) : undefined,
    },
  })

  return {
    success: true,
    message: `Patient created: ${patient.firstName} ${patient.lastName} (ID: ${patient.patientId}, Phone: ${patient.phone}).`,
    patientId: patient.patientId,
  }
}

export async function execUpdatePatient(params: Record<string, string>, hospitalId: string) {
  const patient = await findPatient(hospitalId, params.query)
  if (!patient) return { success: false, message: `Patient "${params.query}" not found.` }

  const data: any = {}
  if (params.phone) data.phone = params.phone
  if (params.email) data.email = params.email
  if (params.address) data.address = params.address
  if (params.city) data.city = params.city
  if (params.age) data.age = parseInt(params.age)
  if (params.firstName) data.firstName = params.firstName
  if (params.lastName) data.lastName = params.lastName
  if (params.gender) data.gender = params.gender
  if (params.bloodGroup) data.bloodGroup = params.bloodGroup

  if (Object.keys(data).length === 0) {
    return { success: false, message: "No fields provided to update." }
  }

  await prisma.patient.update({ where: { id: patient.id }, data })

  return {
    success: true,
    message: `Updated patient ${patient.firstName} ${patient.lastName}: ${Object.keys(data).join(", ")} changed.`,
  }
}

export async function execSearchPatients(params: Record<string, string>, hospitalId: string) {
  const where: any = { hospitalId }
  if (params.query) {
    where.OR = [
      { firstName: { contains: params.query } },
      { lastName: { contains: params.query } },
      { phone: { contains: params.query } },
      { patientId: params.query },
    ]
  }
  if (params.gender) where.gender = params.gender
  if (params.minAge) where.age = { gte: parseInt(params.minAge) }

  const patients = await prisma.patient.findMany({
    where,
    select: { patientId: true, firstName: true, lastName: true, phone: true, age: true, gender: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  return {
    success: true,
    count: patients.length,
    patients: patients.map((p) => ({
      id: p.patientId,
      name: `${p.firstName} ${p.lastName}`,
      phone: p.phone,
      age: p.age,
      gender: p.gender,
    })),
  }
}

// ---------------------------------------------------------------------------
// 2. APPOINTMENT MANAGEMENT
// ---------------------------------------------------------------------------

export async function execBookAppointment(params: Record<string, string>, hospitalId: string) {
  const patient = await findPatient(hospitalId, params.patientName)
  if (!patient) return { success: false, message: `Patient "${params.patientName}" not found. Create them first using the create_patient action.` }

  const doctor = await findDoctor(hospitalId, params.doctorName)
  if (!doctor) return { success: false, message: params.doctorName ? `Doctor "${params.doctorName}" not found.` : "No doctors available." }

  const date = params.date || new Date().toISOString().split("T")[0]
  const time = params.time || "10:00"

  const conflict = await prisma.appointment.findFirst({
    where: {
      hospitalId,
      doctorId: doctor.id,
      scheduledDate: new Date(date + "T00:00:00"),
      scheduledTime: time,
      status: { in: ["SCHEDULED", "CONFIRMED", "CHECKED_IN"] },
    },
  })
  if (conflict) {
    return { success: false, message: `Dr. ${doctor.firstName} already has a booking at ${time} on ${date}. Pick another time.` }
  }

  const appointmentNo = await nextNumber(hospitalId, "appointment", "APT")

  await prisma.appointment.create({
    data: {
      hospitalId,
      appointmentNo,
      patientId: patient.id,
      doctorId: doctor.id,
      scheduledDate: new Date(date + "T00:00:00"),
      scheduledTime: time,
      duration: params.duration ? parseInt(params.duration) : 30,
      appointmentType: (params.type as any) || "CONSULTATION",
      status: "SCHEDULED",
      priority: params.type === "EMERGENCY" ? "URGENT" : "NORMAL",
      chiefComplaint: params.complaint || undefined,
    },
  })

  return {
    success: true,
    message: `Appointment ${appointmentNo} booked for ${patient.firstName} ${patient.lastName} with Dr. ${doctor.firstName} on ${date} at ${time}.`,
  }
}

export async function execCancelAppointment(params: Record<string, string>, hospitalId: string) {
  let appointment
  if (params.appointmentNo) {
    appointment = await prisma.appointment.findFirst({
      where: { hospitalId, appointmentNo: params.appointmentNo, status: { in: ["SCHEDULED", "CONFIRMED"] } },
      include: { patient: { select: { firstName: true, lastName: true } }, doctor: { select: { firstName: true } } },
    })
  } else if (params.patientName) {
    const patient = await findPatient(hospitalId, params.patientName)
    if (!patient) return { success: false, message: `Patient "${params.patientName}" not found.` }
    appointment = await prisma.appointment.findFirst({
      where: { hospitalId, patientId: patient.id, status: { in: ["SCHEDULED", "CONFIRMED"] } },
      include: { patient: { select: { firstName: true, lastName: true } }, doctor: { select: { firstName: true } } },
      orderBy: { scheduledDate: "asc" },
    })
  }
  if (!appointment) return { success: false, message: "No upcoming appointment found to cancel." }

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: params.reason || "Cancelled via AI chat" },
  })

  return {
    success: true,
    message: `Appointment ${appointment.appointmentNo} for ${appointment.patient.firstName} ${appointment.patient.lastName} on ${appointment.scheduledDate.toISOString().split("T")[0]} at ${appointment.scheduledTime} has been cancelled.`,
  }
}

export async function execRescheduleAppointment(params: Record<string, string>, hospitalId: string) {
  if (!params.newDate && !params.newTime) {
    return { success: false, message: "Provide a new date and/or time to reschedule." }
  }

  let appointment
  if (params.appointmentNo) {
    appointment = await prisma.appointment.findFirst({
      where: { hospitalId, appointmentNo: params.appointmentNo, status: { in: ["SCHEDULED", "CONFIRMED"] } },
      include: { patient: { select: { firstName: true, lastName: true } }, doctor: { select: { firstName: true, id: true } } },
    })
  } else if (params.patientName) {
    const patient = await findPatient(hospitalId, params.patientName)
    if (!patient) return { success: false, message: `Patient "${params.patientName}" not found.` }
    appointment = await prisma.appointment.findFirst({
      where: { hospitalId, patientId: patient.id, status: { in: ["SCHEDULED", "CONFIRMED"] } },
      include: { patient: { select: { firstName: true, lastName: true } }, doctor: { select: { firstName: true, id: true } } },
      orderBy: { scheduledDate: "asc" },
    })
  }
  if (!appointment) return { success: false, message: "No upcoming appointment found to reschedule." }

  const newDate = params.newDate || appointment.scheduledDate.toISOString().split("T")[0]
  const newTime = params.newTime || appointment.scheduledTime

  // Check conflict on new slot
  const conflict = await prisma.appointment.findFirst({
    where: {
      hospitalId,
      doctorId: appointment.doctor.id,
      scheduledDate: new Date(newDate + "T00:00:00"),
      scheduledTime: newTime,
      status: { in: ["SCHEDULED", "CONFIRMED", "CHECKED_IN"] },
      id: { not: appointment.id },
    },
  })
  if (conflict) {
    return { success: false, message: `Dr. ${appointment.doctor.firstName} already has a booking at ${newTime} on ${newDate}.` }
  }

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      scheduledDate: new Date(newDate + "T00:00:00"),
      scheduledTime: newTime,
      status: "RESCHEDULED",
    },
  })

  return {
    success: true,
    message: `Appointment ${appointment.appointmentNo} for ${appointment.patient.firstName} ${appointment.patient.lastName} rescheduled to ${newDate} at ${newTime}.`,
  }
}

export async function execCompleteAppointment(params: Record<string, string>, hospitalId: string) {
  let appointment
  if (params.appointmentNo) {
    appointment = await prisma.appointment.findFirst({
      where: { hospitalId, appointmentNo: params.appointmentNo, status: { in: ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"] } },
      include: { patient: { select: { firstName: true, lastName: true } } },
    })
  } else if (params.patientName) {
    const patient = await findPatient(hospitalId, params.patientName)
    if (!patient) return { success: false, message: `Patient "${params.patientName}" not found.` }
    appointment = await prisma.appointment.findFirst({
      where: { hospitalId, patientId: patient.id, status: { in: ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"] } },
      include: { patient: { select: { firstName: true, lastName: true } } },
      orderBy: { scheduledDate: "desc" },
    })
  }
  if (!appointment) return { success: false, message: "No active appointment found to complete." }

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "COMPLETED", checkedOutAt: new Date() },
  })

  return {
    success: true,
    message: `Appointment ${appointment.appointmentNo} for ${appointment.patient.firstName} ${appointment.patient.lastName} marked as completed.`,
  }
}

export async function execShowAppointments(params: Record<string, string>, hospitalId: string) {
  const date = params.date || new Date().toISOString().split("T")[0]
  const where: any = { hospitalId, scheduledDate: new Date(date + "T00:00:00") }
  if (params.status) where.status = params.status
  if (params.doctorName) {
    const doctor = await findDoctor(hospitalId, params.doctorName)
    if (doctor) where.doctorId = doctor.id
  }

  const appts = await prisma.appointment.findMany({
    where,
    include: {
      patient: { select: { firstName: true, lastName: true } },
      doctor: { select: { firstName: true, lastName: true } },
    },
    orderBy: { scheduledTime: "asc" },
  })
  return {
    success: true,
    date,
    count: appts.length,
    appointments: appts.map((a) => ({
      appointmentNo: a.appointmentNo,
      time: a.scheduledTime,
      patient: `${a.patient.firstName} ${a.patient.lastName}`,
      doctor: `Dr. ${a.doctor.firstName} ${a.doctor.lastName}`,
      type: a.appointmentType,
      status: a.status,
    })),
  }
}

// ---------------------------------------------------------------------------
// 3. TREATMENT & CLINICAL
// ---------------------------------------------------------------------------

export async function execCreateTreatment(params: Record<string, string>, hospitalId: string) {
  const patient = await findPatient(hospitalId, params.patientName)
  if (!patient) return { success: false, message: `Patient "${params.patientName}" not found.` }

  const procedure = await prisma.procedure.findFirst({
    where: { hospitalId, isActive: true, OR: [{ name: { contains: params.procedureName } }, { code: params.procedureName }] },
  })
  if (!procedure) return { success: false, message: `Procedure "${params.procedureName}" not found. Check the procedure list.` }

  const doctor = await findDoctor(hospitalId, params.doctorName)
  if (!doctor) return { success: false, message: params.doctorName ? `Doctor "${params.doctorName}" not found.` : "No doctors available." }

  const treatmentNo = await nextNumber(hospitalId, "treatment", "TRT")

  const treatment = await prisma.treatment.create({
    data: {
      hospitalId,
      treatmentNo,
      patientId: patient.id,
      procedureId: procedure.id,
      doctorId: doctor.id,
      cost: params.cost ? parseFloat(params.cost) : Number(procedure.basePrice),
      status: "IN_PROGRESS",
      chiefComplaint: params.complaint || undefined,
      diagnosis: params.diagnosis || undefined,
      toothNumbers: params.toothNumbers || undefined,
    },
  })

  return {
    success: true,
    message: `Treatment ${treatment.treatmentNo} created: ${procedure.name} for ${patient.firstName} ${patient.lastName} by Dr. ${doctor.firstName}. Cost: ₹${Number(treatment.cost).toLocaleString("en-IN")}.`,
  }
}

export async function execCompleteTreatment(params: Record<string, string>, hospitalId: string) {
  let treatment
  if (params.treatmentNo) {
    treatment = await prisma.treatment.findFirst({
      where: { hospitalId, treatmentNo: params.treatmentNo, status: { in: ["PLANNED", "IN_PROGRESS"] } },
      include: { patient: { select: { firstName: true, lastName: true } }, procedure: { select: { name: true } } },
    })
  } else if (params.patientName) {
    const patient = await findPatient(hospitalId, params.patientName)
    if (!patient) return { success: false, message: `Patient "${params.patientName}" not found.` }
    treatment = await prisma.treatment.findFirst({
      where: { hospitalId, patientId: patient.id, status: { in: ["PLANNED", "IN_PROGRESS"] } },
      include: { patient: { select: { firstName: true, lastName: true } }, procedure: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    })
  }
  if (!treatment) return { success: false, message: "No active treatment found to complete." }

  await prisma.treatment.update({
    where: { id: treatment.id },
    data: {
      status: "COMPLETED",
      endTime: new Date(),
      procedureNotes: params.notes || undefined,
      followUpRequired: params.followUpDate ? true : false,
      followUpDate: params.followUpDate ? new Date(params.followUpDate) : undefined,
    },
  })

  return {
    success: true,
    message: `Treatment ${treatment.treatmentNo} (${treatment.procedure.name}) for ${treatment.patient.firstName} ${treatment.patient.lastName} marked as completed.`,
  }
}

export async function execShowTreatments(params: Record<string, string>, hospitalId: string) {
  const where: any = { hospitalId }
  if (params.patientName) {
    const patient = await findPatient(hospitalId, params.patientName)
    if (patient) where.patientId = patient.id
  }
  if (params.status) where.status = params.status

  const treatments = await prisma.treatment.findMany({
    where,
    include: {
      patient: { select: { firstName: true, lastName: true } },
      procedure: { select: { name: true } },
      doctor: { select: { firstName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 15,
  })

  return {
    success: true,
    count: treatments.length,
    treatments: treatments.map((t) => ({
      treatmentNo: t.treatmentNo,
      patient: `${t.patient.firstName} ${t.patient.lastName}`,
      procedure: t.procedure.name,
      doctor: `Dr. ${t.doctor.firstName}`,
      cost: `₹${Number(t.cost).toLocaleString("en-IN")}`,
      status: t.status,
      date: t.createdAt.toISOString().split("T")[0],
    })),
  }
}

// ---------------------------------------------------------------------------
// 4. BILLING & PAYMENTS
// ---------------------------------------------------------------------------

export async function execCreateInvoice(params: Record<string, string>, hospitalId: string) {
  const patient = await findPatient(hospitalId, params.query || params.patientName)
  if (!patient) return { success: false, message: `Patient "${params.query || params.patientName}" not found.` }

  const unbilled = await prisma.treatment.findMany({
    where: { hospitalId, patientId: patient.id, status: "COMPLETED", invoiceItems: { none: {} } },
    include: { procedure: { select: { name: true } } },
  })
  if (unbilled.length === 0) return { success: false, message: `No unbilled completed treatments for ${patient.firstName} ${patient.lastName}.` }

  const subtotal = unbilled.reduce((s, t) => s + Number(t.cost), 0)
  const cgstRate = 9
  const sgstRate = 9
  const taxableAmount = subtotal
  const cgstAmount = (taxableAmount * cgstRate) / 100
  const sgstAmount = (taxableAmount * sgstRate) / 100
  const totalAmount = subtotal + cgstAmount + sgstAmount

  const invoiceNo = await nextNumber(hospitalId, "invoice", "INV")

  const invoice = await prisma.invoice.create({
    data: {
      hospitalId,
      invoiceNo,
      patientId: patient.id,
      subtotal,
      taxableAmount,
      cgstRate,
      sgstRate,
      cgstAmount,
      sgstAmount,
      totalAmount,
      balanceAmount: totalAmount,
      status: "PENDING",
      items: {
        create: unbilled.map((t) => ({
          treatmentId: t.id,
          description: t.procedure.name,
          unitPrice: Number(t.cost),
          amount: Number(t.cost),
        })),
      },
    },
  })

  return {
    success: true,
    message: `Invoice ${invoice.invoiceNo} created for ${patient.firstName} ${patient.lastName}. Subtotal: ₹${subtotal.toLocaleString("en-IN")}, GST: ₹${(cgstAmount + sgstAmount).toFixed(2)}, Total: ₹${totalAmount.toFixed(2)}. Includes ${unbilled.length} treatment(s).`,
    invoiceNo: invoice.invoiceNo,
  }
}

export async function execRecordPayment(params: Record<string, string>, hospitalId: string) {
  if (!params.invoiceNo && !params.patientName) {
    return { success: false, message: "Provide an invoice number or patient name." }
  }

  let invoice
  if (params.invoiceNo) {
    invoice = await prisma.invoice.findFirst({
      where: { hospitalId, invoiceNo: params.invoiceNo, status: { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE"] } },
      include: { patient: { select: { firstName: true, lastName: true } } },
    })
  } else {
    const patient = await findPatient(hospitalId, params.patientName)
    if (!patient) return { success: false, message: `Patient "${params.patientName}" not found.` }
    invoice = await prisma.invoice.findFirst({
      where: { hospitalId, patientId: patient.id, status: { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE"] } },
      include: { patient: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
    })
  }
  if (!invoice) return { success: false, message: "No pending invoice found." }

  const amount = params.amount ? parseFloat(params.amount) : Number(invoice.balanceAmount)
  if (amount <= 0) return { success: false, message: "Payment amount must be positive." }
  if (amount > Number(invoice.balanceAmount)) {
    return { success: false, message: `Amount ₹${amount} exceeds balance ₹${Number(invoice.balanceAmount).toLocaleString("en-IN")}.` }
  }

  const paymentNo = await nextNumber(hospitalId, "payment", "PAY")
  const method = (params.method?.toUpperCase() || "CASH") as any

  await prisma.payment.create({
    data: {
      hospitalId,
      paymentNo,
      invoiceId: invoice.id,
      amount,
      paymentMethod: method,
      status: "COMPLETED",
    },
  })

  const newPaid = Number(invoice.paidAmount) + amount
  const newBalance = Number(invoice.totalAmount) - newPaid

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      paidAmount: newPaid,
      balanceAmount: newBalance,
      status: newBalance <= 0 ? "PAID" : "PARTIALLY_PAID",
    },
  })

  return {
    success: true,
    message: `Payment ${paymentNo} of ₹${amount.toLocaleString("en-IN")} recorded for invoice ${invoice.invoiceNo} (${invoice.patient.firstName} ${invoice.patient.lastName}). ${newBalance <= 0 ? "Invoice fully paid." : `Remaining balance: ₹${newBalance.toFixed(2)}.`}`,
  }
}

export async function execShowInvoices(params: Record<string, string>, hospitalId: string) {
  const where: any = { hospitalId }
  if (params.status) where.status = params.status.toUpperCase()
  if (params.patientName) {
    const patient = await findPatient(hospitalId, params.patientName)
    if (patient) where.patientId = patient.id
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: { patient: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
    take: 15,
  })

  return {
    success: true,
    count: invoices.length,
    invoices: invoices.map((i) => ({
      invoiceNo: i.invoiceNo,
      patient: `${i.patient.firstName} ${i.patient.lastName}`,
      total: `₹${Number(i.totalAmount).toLocaleString("en-IN")}`,
      paid: `₹${Number(i.paidAmount).toLocaleString("en-IN")}`,
      balance: `₹${Number(i.balanceAmount).toLocaleString("en-IN")}`,
      status: i.status,
      date: i.createdAt.toISOString().split("T")[0],
    })),
  }
}

export async function execCheckOverdue(hospitalId: string) {
  const overdue = await prisma.invoice.findMany({
    where: { hospitalId, status: "OVERDUE" },
    include: { patient: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "asc" },
    take: 10,
  })
  return {
    success: true,
    count: overdue.length,
    totalOverdue: `₹${overdue.reduce((s, i) => s + Number(i.balanceAmount), 0).toLocaleString("en-IN")}`,
    invoices: overdue.map((i) => ({
      invoiceNo: i.invoiceNo,
      patient: `${i.patient.firstName} ${i.patient.lastName}`,
      balance: `₹${Number(i.balanceAmount).toLocaleString("en-IN")}`,
    })),
  }
}

export async function execShowRevenue(params: Record<string, string>, hospitalId: string) {
  const now = new Date()
  const period = params.period || "this_month"
  let startDate: Date
  switch (period) {
    case "today":        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break
    case "this_week":    startDate = new Date(now); startDate.setDate(now.getDate() - now.getDay()); break
    case "last_month":   startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1); break
    case "this_quarter": startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); break
    default:             startDate = new Date(now.getFullYear(), now.getMonth(), 1)
  }

  const invoices = await prisma.invoice.findMany({
    where: { hospitalId, createdAt: { gte: startDate }, status: { not: "CANCELLED" } },
    select: { totalAmount: true, paidAmount: true },
  })
  const billed = invoices.reduce((s, i) => s + Number(i.totalAmount), 0)
  const collected = invoices.reduce((s, i) => s + Number(i.paidAmount), 0)

  return {
    success: true,
    period,
    totalBilled: `₹${billed.toLocaleString("en-IN")}`,
    totalCollected: `₹${collected.toLocaleString("en-IN")}`,
    collectionRate: billed > 0 ? `${((collected / billed) * 100).toFixed(1)}%` : "N/A",
    invoiceCount: invoices.length,
  }
}

// ---------------------------------------------------------------------------
// 5. INVENTORY
// ---------------------------------------------------------------------------

export async function execCheckStock(params: Record<string, string>, hospitalId: string) {
  const items = await prisma.inventoryItem.findMany({
    where: { hospitalId, name: { contains: params.itemName } },
    select: { name: true, currentStock: true, minimumStock: true, reorderLevel: true, unit: true },
  })
  if (items.length === 0) return { success: false, message: `No items matching "${params.itemName}".` }

  return {
    success: true,
    items: items.map((i) => ({
      name: i.name,
      stock: `${i.currentStock} ${i.unit}`,
      status: i.currentStock <= i.minimumStock ? "Critical" : i.currentStock <= i.reorderLevel ? "Low" : "OK",
    })),
  }
}

export async function execLowStock(hospitalId: string) {
  const all = await prisma.inventoryItem.findMany({
    where: { hospitalId, isActive: true },
    select: { name: true, currentStock: true, reorderLevel: true, minimumStock: true, unit: true },
  })
  const low = all.filter((i) => i.currentStock <= i.reorderLevel)
  return {
    success: true,
    count: low.length,
    items: low.map((i) => ({
      name: i.name,
      stock: `${i.currentStock} ${i.unit}`,
      status: i.currentStock <= i.minimumStock ? "Critical" : "Low",
      reorderLevel: i.reorderLevel,
    })),
  }
}

export async function execAddInventoryItem(params: Record<string, string>, hospitalId: string) {
  if (!params.name) return { success: false, message: "Item name is required." }

  const existing = await prisma.inventoryItem.findFirst({
    where: { hospitalId, name: { contains: params.name } },
  })
  if (existing) {
    return { success: false, message: `Item "${existing.name}" already exists (SKU: ${existing.sku}).` }
  }

  const count = await prisma.inventoryItem.count({ where: { hospitalId } })
  const sku = params.sku || `ITM-${String(count + 1).padStart(5, "0")}`

  const item = await prisma.inventoryItem.create({
    data: {
      hospitalId,
      sku,
      name: params.name,
      unit: params.unit || "pcs",
      purchasePrice: params.price ? parseFloat(params.price) : 0,
      currentStock: params.quantity ? parseInt(params.quantity) : 0,
      minimumStock: params.minStock ? parseInt(params.minStock) : 10,
      reorderLevel: params.reorderLevel ? parseInt(params.reorderLevel) : 20,
    },
  })

  return {
    success: true,
    message: `Inventory item "${item.name}" added (SKU: ${item.sku}, Stock: ${item.currentStock} ${item.unit}).`,
  }
}

export async function execUpdateStock(params: Record<string, string>, hospitalId: string) {
  const item = await prisma.inventoryItem.findFirst({
    where: { hospitalId, OR: [{ name: { contains: params.itemName } }, { sku: params.itemName }] },
  })
  if (!item) return { success: false, message: `Item "${params.itemName}" not found.` }

  const qty = parseInt(params.quantity)
  if (isNaN(qty) || qty <= 0) return { success: false, message: "Provide a valid positive quantity." }

  const type = (params.type || "add").toLowerCase()
  const previousStock = item.currentStock
  const newStock = type === "remove" || type === "subtract" ? previousStock - qty : previousStock + qty

  if (newStock < 0) return { success: false, message: `Cannot remove ${qty} — only ${previousStock} in stock.` }

  await prisma.inventoryItem.update({
    where: { id: item.id },
    data: { currentStock: newStock },
  })

  await prisma.stockTransaction.create({
    data: {
      hospitalId,
      itemId: item.id,
      type: type === "remove" || type === "subtract" ? "CONSUMPTION" : "PURCHASE",
      quantity: qty,
      previousStock,
      newStock,
      notes: params.reason || `Stock ${type} via AI chat`,
    },
  })

  return {
    success: true,
    message: `${item.name}: ${previousStock} → ${newStock} ${item.unit} (${type === "remove" || type === "subtract" ? "removed" : "added"} ${qty}).`,
  }
}

// ---------------------------------------------------------------------------
// 6. LAB ORDERS
// ---------------------------------------------------------------------------

export async function execCreateLabOrder(params: Record<string, string>, hospitalId: string) {
  const patient = await findPatient(hospitalId, params.patientName)
  if (!patient) return { success: false, message: `Patient "${params.patientName}" not found.` }

  const vendor = await prisma.labVendor.findFirst({
    where: { hospitalId, isActive: true, OR: [{ name: { contains: params.labName || "" } }] },
  })
  if (!vendor) return { success: false, message: params.labName ? `Lab vendor "${params.labName}" not found.` : "No active lab vendors found." }

  const orderNumber = await nextNumber(hospitalId, "labOrder", "LAB")

  const order = await prisma.labOrder.create({
    data: {
      hospitalId,
      orderNumber,
      patientId: patient.id,
      labVendorId: vendor.id,
      workType: (params.workType as any) || "CROWN",
      estimatedCost: params.cost ? parseFloat(params.cost) : 0,
      description: params.description || undefined,
      toothNumbers: params.toothNumbers || undefined,
      shadeGuide: params.shade || undefined,
      status: "CREATED",
    },
  })

  return {
    success: true,
    message: `Lab order ${order.orderNumber} created: ${params.workType || "CROWN"} for ${patient.firstName} ${patient.lastName}, sent to ${vendor.name}.`,
  }
}

export async function execUpdateLabOrder(params: Record<string, string>, hospitalId: string) {
  const order = await prisma.labOrder.findFirst({
    where: { hospitalId, orderNumber: params.orderNumber },
    include: { patient: { select: { firstName: true, lastName: true } } },
  })
  if (!order) return { success: false, message: `Lab order "${params.orderNumber}" not found.` }

  const validStatuses = ["CREATED", "SENT_TO_LAB", "IN_PROGRESS", "QUALITY_CHECK", "READY", "DELIVERED", "FITTED", "REMAKE_REQUIRED", "CANCELLED"]
  if (params.status && !validStatuses.includes(params.status)) {
    return { success: false, message: `Invalid status. Valid options: ${validStatuses.join(", ")}` }
  }

  const data: any = {}
  if (params.status) {
    data.status = params.status
    if (params.status === "SENT_TO_LAB") data.sentDate = new Date()
    if (params.status === "READY" || params.status === "DELIVERED") data.receivedDate = new Date()
    if (params.status === "FITTED") data.deliveredDate = new Date()
  }
  if (params.notes) data.notes = params.notes

  await prisma.labOrder.update({ where: { id: order.id }, data })

  return {
    success: true,
    message: `Lab order ${order.orderNumber} for ${order.patient.firstName} ${order.patient.lastName} updated to ${params.status || "updated"}.`,
  }
}

export async function execShowLabOrders(params: Record<string, string>, hospitalId: string) {
  const where: any = { hospitalId }
  if (params.status) where.status = params.status
  if (params.patientName) {
    const patient = await findPatient(hospitalId, params.patientName)
    if (patient) where.patientId = patient.id
  }

  const orders = await prisma.labOrder.findMany({
    where,
    include: {
      patient: { select: { firstName: true, lastName: true } },
      labVendor: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 15,
  })

  return {
    success: true,
    count: orders.length,
    orders: orders.map((o) => ({
      orderNumber: o.orderNumber,
      patient: `${o.patient.firstName} ${o.patient.lastName}`,
      lab: o.labVendor.name,
      workType: o.workType,
      status: o.status,
      date: o.orderDate.toISOString().split("T")[0],
    })),
  }
}

// ---------------------------------------------------------------------------
// 7. PRESCRIPTIONS
// ---------------------------------------------------------------------------

export async function execCreatePrescription(params: Record<string, string>, hospitalId: string) {
  const patient = await findPatient(hospitalId, params.patientName)
  if (!patient) return { success: false, message: `Patient "${params.patientName}" not found.` }

  const doctor = await findDoctor(hospitalId, params.doctorName)
  if (!doctor) return { success: false, message: params.doctorName ? `Doctor "${params.doctorName}" not found.` : "No doctors available." }

  const prescriptionNo = await nextNumber(hospitalId, "prescription", "RX")

  // Parse medications: expects comma-separated "name dosage frequency duration"
  const medLines = (params.medications || "").split(",").map((m) => m.trim()).filter(Boolean)
  const medications = medLines.map((line) => {
    const parts = line.split(" ")
    return {
      medicationName: parts[0] || line,
      dosage: parts[1] || "As directed",
      frequency: parts[2] || "Once daily",
      duration: parts[3] || "5 days",
      route: "Oral",
    }
  })

  const prescription = await prisma.prescription.create({
    data: {
      hospitalId,
      prescriptionNo,
      patientId: patient.id,
      doctorId: doctor.id,
      diagnosis: params.diagnosis || undefined,
      notes: params.notes || undefined,
      medications: medications.length > 0 ? { create: medications } : undefined,
    },
  })

  return {
    success: true,
    message: `Prescription ${prescription.prescriptionNo} created for ${patient.firstName} ${patient.lastName} by Dr. ${doctor.firstName}. ${medications.length} medication(s) prescribed.`,
  }
}

// ---------------------------------------------------------------------------
// 7b. MEDICATIONS (Drug Catalog)
// ---------------------------------------------------------------------------

export async function execAddMedication(params: Record<string, string>, hospitalId: string) {
  if (!params.name) return { success: false, message: "Medication name is required." }

  const existing = await prisma.medication.findFirst({
    where: { hospitalId, name: { contains: params.name } },
  })
  if (existing) {
    return { success: false, message: `Medication "${existing.name}" already exists in your catalog.` }
  }

  const medication = await prisma.medication.create({
    data: {
      hospitalId,
      name: params.name,
      genericName: params.genericName || undefined,
      category: params.category || undefined,
      form: params.form || undefined,
      strength: params.strength || undefined,
      manufacturer: params.manufacturer || undefined,
      defaultDosage: params.defaultDosage || undefined,
      defaultFrequency: params.defaultFrequency || undefined,
      defaultDuration: params.defaultDuration || undefined,
    },
  })

  return {
    success: true,
    message: `Medication "${medication.name}"${params.strength ? ` ${params.strength}` : ""} added to the drug catalog${params.category ? ` under ${params.category}` : ""}.`,
  }
}

export async function execSearchMedications(params: Record<string, string>, hospitalId: string) {
  const where: any = { hospitalId, isActive: true }
  if (params.query) {
    where.OR = [
      { name: { contains: params.query } },
      { genericName: { contains: params.query } },
      { manufacturer: { contains: params.query } },
    ]
  }
  if (params.category) where.category = params.category

  const medications = await prisma.medication.findMany({
    where,
    select: { name: true, genericName: true, category: true, form: true, strength: true, defaultDosage: true, defaultFrequency: true, defaultDuration: true },
    orderBy: { name: "asc" },
    take: 20,
  })

  return {
    success: true,
    count: medications.length,
    medications: medications.map((m) => ({
      name: m.name,
      generic: m.genericName,
      category: m.category,
      formStrength: [m.form, m.strength].filter(Boolean).join(" "),
      defaultRx: [m.defaultDosage, m.defaultFrequency, m.defaultDuration].filter(Boolean).join(", ") || "—",
    })),
  }
}

export async function execShowPrescriptions(params: Record<string, string>, hospitalId: string) {
  const where: any = { hospitalId }
  if (params.patientName) {
    const patient = await findPatient(hospitalId, params.patientName)
    if (patient) where.patientId = patient.id
  }
  if (params.doctorName) {
    const doctor = await findDoctor(hospitalId, params.doctorName)
    if (doctor) where.doctorId = doctor.id
  }

  const prescriptions = await prisma.prescription.findMany({
    where,
    include: {
      patient: { select: { firstName: true, lastName: true } },
      doctor: { select: { firstName: true, lastName: true } },
      medications: { select: { medicationName: true, dosage: true, frequency: true, duration: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 15,
  })

  return {
    success: true,
    count: prescriptions.length,
    prescriptions: prescriptions.map((rx) => ({
      prescriptionNo: rx.prescriptionNo,
      patient: `${rx.patient.firstName} ${rx.patient.lastName}`,
      doctor: `Dr. ${rx.doctor.firstName} ${rx.doctor.lastName}`,
      diagnosis: rx.diagnosis || "—",
      medications: rx.medications.map((m) => `${m.medicationName} ${m.dosage} ${m.frequency} × ${m.duration}`).join("; "),
      date: rx.createdAt.toISOString().split("T")[0],
    })),
  }
}

// ---------------------------------------------------------------------------
// 8. STAFF
// ---------------------------------------------------------------------------

export async function execShowStaff(hospitalId: string) {
  const staff = await prisma.staff.findMany({
    where: { hospitalId, isActive: true },
    include: { user: { select: { role: true } } },
    orderBy: { firstName: "asc" },
  })

  return {
    success: true,
    count: staff.length,
    staff: staff.map((s) => ({
      employeeId: s.employeeId,
      name: `${s.firstName} ${s.lastName}`,
      role: s.user.role,
      phone: s.phone,
      specialization: s.specialization,
    })),
  }
}

// ---------------------------------------------------------------------------
// 9. DAILY SUMMARY / ANALYTICS
// ---------------------------------------------------------------------------

export async function execDailySummary(hospitalId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const [
    totalPatients,
    newPatientsToday,
    todayAppointments,
    completedToday,
    cancelledToday,
    noShowToday,
    pendingInvoices,
    overdueInvoices,
    todayRevenue,
    lowStockCount,
    activeLabOrders,
  ] = await Promise.all([
    prisma.patient.count({ where: { hospitalId } }),
    prisma.patient.count({ where: { hospitalId, createdAt: { gte: today } } }),
    prisma.appointment.count({ where: { hospitalId, scheduledDate: today } }),
    prisma.appointment.count({ where: { hospitalId, scheduledDate: today, status: "COMPLETED" } }),
    prisma.appointment.count({ where: { hospitalId, scheduledDate: today, status: "CANCELLED" } }),
    prisma.appointment.count({ where: { hospitalId, scheduledDate: today, status: "NO_SHOW" } }),
    prisma.invoice.count({ where: { hospitalId, status: { in: ["PENDING", "PARTIALLY_PAID"] } } }),
    prisma.invoice.count({ where: { hospitalId, status: "OVERDUE" } }),
    prisma.payment.aggregate({
      where: { hospitalId, paymentDate: { gte: today, lt: tomorrow }, status: "COMPLETED" },
      _sum: { amount: true },
    }),
    prisma.inventoryItem.findMany({
      where: { hospitalId, isActive: true },
      select: { currentStock: true, reorderLevel: true },
    }).then((items) => items.filter((i) => i.currentStock <= i.reorderLevel).length),
    prisma.labOrder.count({
      where: { hospitalId, status: { in: ["CREATED", "SENT_TO_LAB", "IN_PROGRESS"] } },
    }),
  ])

  return {
    success: true,
    summary: {
      date: today.toISOString().split("T")[0],
      totalPatients,
      newPatientsToday,
      appointments: {
        total: todayAppointments,
        completed: completedToday,
        cancelled: cancelledToday,
        noShow: noShowToday,
        remaining: todayAppointments - completedToday - cancelledToday - noShowToday,
      },
      billing: {
        todayCollected: `₹${Number(todayRevenue._sum.amount || 0).toLocaleString("en-IN")}`,
        pendingInvoices,
        overdueInvoices,
      },
      lowStockItems: lowStockCount,
      activeLabOrders,
    },
  }
}

// ---------------------------------------------------------------------------
// 10. PATIENT DETAILS (deep look-up, extended version of check_patient)
// ---------------------------------------------------------------------------

export async function execCheckPatient(params: Record<string, string>, hospitalId: string) {
  const q = params.query
  const patient = await prisma.patient.findFirst({
    where: {
      hospitalId,
      OR: [
        { patientId: q },
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { phone: { contains: q } },
      ],
    },
    include: {
      medicalHistory: true,
      treatmentPlans: { orderBy: { createdAt: "desc" }, take: 3 },
      appointments: { orderBy: { scheduledDate: "desc" }, take: 3 },
      invoices: { where: { status: { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE"] } } },
    },
  })
  if (!patient) return { success: false, message: `Patient "${q}" not found.` }

  const flags: string[] = []
  if (patient.medicalHistory) {
    const h = patient.medicalHistory
    if (h.drugAllergies) flags.push(`Allergies: ${h.drugAllergies}`)
    if (h.hasDiabetes) flags.push("Diabetes")
    if (h.hasHypertension) flags.push("Hypertension")
    if (h.isPregnant) flags.push("Pregnant")
    if (h.hasBleedingDisorder) flags.push("Bleeding Disorder")
  }

  return {
    success: true,
    summary: {
      name: `${patient.firstName} ${patient.lastName}`,
      id: patient.patientId,
      age: patient.age,
      phone: patient.phone,
      gender: patient.gender,
      email: patient.email,
      medicalFlags: flags,
      outstandingBalance: `₹${patient.invoices.reduce((s, i) => s + Number(i.balanceAmount), 0).toLocaleString("en-IN")}`,
      recentAppointments: patient.appointments.map((a) => `${a.scheduledDate.toISOString().split("T")[0]} – ${a.appointmentType} (${a.status})`),
      treatmentPlans: patient.treatmentPlans.map((tp) => `${tp.title} – ${tp.status}`),
    },
  }
}

// ---------------------------------------------------------------------------
// Dispatcher — maps intent name to executor
// ---------------------------------------------------------------------------
export async function executeIntent(
  intent: string,
  params: Record<string, string>,
  hospitalId: string
): Promise<any> {
  switch (intent) {
    // Patient
    case "create_patient":        return execCreatePatient(params, hospitalId)
    case "update_patient":        return execUpdatePatient(params, hospitalId)
    case "search_patients":       return execSearchPatients(params, hospitalId)
    case "check_patient":         return execCheckPatient(params, hospitalId)

    // Appointments
    case "book_appointment":      return execBookAppointment(params, hospitalId)
    case "cancel_appointment":    return execCancelAppointment(params, hospitalId)
    case "reschedule_appointment": return execRescheduleAppointment(params, hospitalId)
    case "complete_appointment":  return execCompleteAppointment(params, hospitalId)
    case "show_appointments":     return execShowAppointments(params, hospitalId)

    // Treatments
    case "create_treatment":      return execCreateTreatment(params, hospitalId)
    case "complete_treatment":    return execCompleteTreatment(params, hospitalId)
    case "show_treatments":       return execShowTreatments(params, hospitalId)

    // Billing
    case "create_invoice":        return execCreateInvoice(params, hospitalId)
    case "generate_invoice":      return execCreateInvoice(params, hospitalId) // alias
    case "record_payment":        return execRecordPayment(params, hospitalId)
    case "show_invoices":         return execShowInvoices(params, hospitalId)
    case "check_overdue":         return execCheckOverdue(hospitalId)
    case "show_revenue":          return execShowRevenue(params, hospitalId)

    // Inventory
    case "check_stock":           return execCheckStock(params, hospitalId)
    case "low_stock":             return execLowStock(hospitalId)
    case "add_inventory_item":    return execAddInventoryItem(params, hospitalId)
    case "update_stock":          return execUpdateStock(params, hospitalId)

    // Lab
    case "create_lab_order":      return execCreateLabOrder(params, hospitalId)
    case "update_lab_order":      return execUpdateLabOrder(params, hospitalId)
    case "show_lab_orders":       return execShowLabOrders(params, hospitalId)

    // Prescriptions
    case "create_prescription":   return execCreatePrescription(params, hospitalId)
    case "show_prescriptions":    return execShowPrescriptions(params, hospitalId)

    // Medications (Drug Catalog)
    case "add_medication":        return execAddMedication(params, hospitalId)
    case "search_medications":    return execSearchMedications(params, hospitalId)

    // Staff
    case "show_staff":            return execShowStaff(hospitalId)

    // Analytics
    case "daily_summary":         return execDailySummary(hospitalId)

    default:                      return null
  }
}
