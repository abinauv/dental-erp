/**
 * Entity schema definitions for data import — defines target fields,
 * validation rules, enum aliases, and FK resolution hints for each entity.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface FieldDefinition {
  name: string
  type: "string" | "integer" | "decimal" | "date" | "datetime" | "boolean" | "enum"
  required: boolean
  description: string
  enumValues?: string[]
  enumAliases?: Record<string, string>
  maxLength?: number
  pattern?: RegExp
  foreignKey?: {
    model: string
    lookupFields: string[]
  }
}

export interface EntitySchema {
  entityType: string
  prismaModel: string
  label: string
  description: string
  uniqueKey: string[] // fields that form the unique constraint (excluding hospitalId)
  autoGenerateId?: string
  autoGeneratePrefix?: string
  fields: FieldDefinition[]
}

// ---------------------------------------------------------------------------
// Enum alias maps — handle common real-world variants
// ---------------------------------------------------------------------------
export const GENDER_ALIASES: Record<string, string> = {
  M: "MALE", F: "FEMALE", Male: "MALE", Female: "FEMALE",
  male: "MALE", female: "FEMALE", other: "OTHER", O: "OTHER",
  m: "MALE", f: "FEMALE", o: "OTHER",
  Man: "MALE", Woman: "FEMALE",
}

export const BLOOD_GROUP_ALIASES: Record<string, string> = {
  "A+": "A_POSITIVE", "A-": "A_NEGATIVE", "B+": "B_POSITIVE", "B-": "B_NEGATIVE",
  "AB+": "AB_POSITIVE", "AB-": "AB_NEGATIVE", "O+": "O_POSITIVE", "O-": "O_NEGATIVE",
  "A +ve": "A_POSITIVE", "A -ve": "A_NEGATIVE", "B +ve": "B_POSITIVE", "B -ve": "B_NEGATIVE",
  "AB +ve": "AB_POSITIVE", "AB -ve": "AB_NEGATIVE", "O +ve": "O_POSITIVE", "O -ve": "O_NEGATIVE",
  "A+ve": "A_POSITIVE", "A-ve": "A_NEGATIVE", "B+ve": "B_POSITIVE", "B-ve": "B_NEGATIVE",
  "AB+ve": "AB_POSITIVE", "AB-ve": "AB_NEGATIVE", "O+ve": "O_POSITIVE", "O-ve": "O_NEGATIVE",
  "a+": "A_POSITIVE", "a-": "A_NEGATIVE", "b+": "B_POSITIVE", "b-": "B_NEGATIVE",
  "ab+": "AB_POSITIVE", "ab-": "AB_NEGATIVE", "o+": "O_POSITIVE", "o-": "O_NEGATIVE",
}

export const APPOINTMENT_TYPE_ALIASES: Record<string, string> = {
  Consultation: "CONSULTATION", Procedure: "PROCEDURE", "Follow Up": "FOLLOW_UP",
  "Follow-Up": "FOLLOW_UP", Followup: "FOLLOW_UP", Emergency: "EMERGENCY",
  "Check Up": "CHECK_UP", Checkup: "CHECK_UP", "Check-Up": "CHECK_UP",
  consultation: "CONSULTATION", procedure: "PROCEDURE",
}

export const APPOINTMENT_STATUS_ALIASES: Record<string, string> = {
  Scheduled: "SCHEDULED", Confirmed: "CONFIRMED", Completed: "COMPLETED",
  Cancelled: "CANCELLED", Canceled: "CANCELLED", "No Show": "NO_SHOW",
  "No-Show": "NO_SHOW", Rescheduled: "RESCHEDULED",
  scheduled: "SCHEDULED", completed: "COMPLETED", cancelled: "CANCELLED",
}

export const TREATMENT_STATUS_ALIASES: Record<string, string> = {
  Planned: "PLANNED", "In Progress": "IN_PROGRESS", Completed: "COMPLETED",
  Cancelled: "CANCELLED", Canceled: "CANCELLED",
  planned: "PLANNED", completed: "COMPLETED",
}

export const INVOICE_STATUS_ALIASES: Record<string, string> = {
  Draft: "DRAFT", Pending: "PENDING", Paid: "PAID", Overdue: "OVERDUE",
  "Partially Paid": "PARTIALLY_PAID", Cancelled: "CANCELLED", Refunded: "REFUNDED",
  paid: "PAID", pending: "PENDING", overdue: "OVERDUE",
}

export const PAYMENT_METHOD_ALIASES: Record<string, string> = {
  Cash: "CASH", Card: "CARD", UPI: "UPI", "Bank Transfer": "BANK_TRANSFER",
  Cheque: "CHEQUE", Check: "CHEQUE", Insurance: "INSURANCE", Wallet: "WALLET",
  Online: "ONLINE", "Net Banking": "BANK_TRANSFER", NEFT: "BANK_TRANSFER",
  RTGS: "BANK_TRANSFER", "Credit Card": "CARD", "Debit Card": "CARD",
  cash: "CASH", card: "CARD", upi: "UPI", cheque: "CHEQUE", online: "ONLINE",
}

export const PAYMENT_STATUS_ALIASES: Record<string, string> = {
  Pending: "PENDING", Completed: "COMPLETED", Failed: "FAILED",
  Refunded: "REFUNDED", Cancelled: "CANCELLED",
  pending: "PENDING", completed: "COMPLETED", paid: "COMPLETED",
}

// ---------------------------------------------------------------------------
// Entity schemas
// ---------------------------------------------------------------------------

const PATIENT_FIELDS: FieldDefinition[] = [
  { name: "patientId", type: "string", required: false, description: "Unique patient ID (auto-generated if blank, e.g. PAT202500001)" },
  { name: "firstName", type: "string", required: true, description: "Patient first name" },
  { name: "lastName", type: "string", required: true, description: "Patient last name" },
  { name: "phone", type: "string", required: true, description: "10-digit mobile number", pattern: /^\d{10}$/ },
  { name: "email", type: "string", required: false, description: "Email address" },
  { name: "dateOfBirth", type: "date", required: false, description: "Date of birth" },
  { name: "age", type: "integer", required: false, description: "Age in years" },
  { name: "gender", type: "enum", required: false, description: "Gender", enumValues: ["MALE", "FEMALE", "OTHER"], enumAliases: GENDER_ALIASES },
  { name: "bloodGroup", type: "enum", required: false, description: "Blood group", enumValues: ["A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE", "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE"], enumAliases: BLOOD_GROUP_ALIASES },
  { name: "address", type: "string", required: false, description: "Full address" },
  { name: "city", type: "string", required: false, description: "City" },
  { name: "state", type: "string", required: false, description: "State" },
  { name: "pincode", type: "string", required: false, description: "PIN code" },
  { name: "occupation", type: "string", required: false, description: "Occupation" },
  { name: "referredBy", type: "string", required: false, description: "Referred by (person or source)" },
  { name: "alternatePhone", type: "string", required: false, description: "Alternate phone number" },
  { name: "aadharNumber", type: "string", required: false, description: "Aadhar number" },
  { name: "emergencyContactName", type: "string", required: false, description: "Emergency contact name" },
  { name: "emergencyContactPhone", type: "string", required: false, description: "Emergency contact phone" },
  { name: "emergencyContactRelation", type: "string", required: false, description: "Relationship to emergency contact" },
]

const STAFF_FIELDS: FieldDefinition[] = [
  { name: "employeeId", type: "string", required: false, description: "Employee ID (auto-generated if blank)" },
  { name: "firstName", type: "string", required: true, description: "Staff first name" },
  { name: "lastName", type: "string", required: true, description: "Staff last name" },
  { name: "phone", type: "string", required: true, description: "10-digit mobile number" },
  { name: "email", type: "string", required: true, description: "Email address (used for login)" },
  { name: "role", type: "string", required: false, description: "Role: DOCTOR, RECEPTIONIST, NURSE, LAB_TECH, ADMIN" },
  { name: "dateOfBirth", type: "date", required: false, description: "Date of birth" },
  { name: "gender", type: "enum", required: false, description: "Gender", enumValues: ["MALE", "FEMALE", "OTHER"], enumAliases: GENDER_ALIASES },
  { name: "qualification", type: "string", required: false, description: "Educational qualification" },
  { name: "specialization", type: "string", required: false, description: "Specialization (for doctors)" },
  { name: "licenseNumber", type: "string", required: false, description: "Professional license number" },
  { name: "joiningDate", type: "date", required: false, description: "Date of joining" },
  { name: "salary", type: "decimal", required: false, description: "Monthly salary" },
  { name: "address", type: "string", required: false, description: "Address" },
  { name: "city", type: "string", required: false, description: "City" },
  { name: "state", type: "string", required: false, description: "State" },
  { name: "pincode", type: "string", required: false, description: "PIN code" },
  { name: "aadharNumber", type: "string", required: false, description: "Aadhar number" },
  { name: "panNumber", type: "string", required: false, description: "PAN number" },
]

const APPOINTMENT_FIELDS: FieldDefinition[] = [
  { name: "appointmentNo", type: "string", required: false, description: "Appointment number (auto-generated if blank)" },
  { name: "patientRef", type: "string", required: true, description: "Patient identifier (patient ID, name, or phone)", foreignKey: { model: "Patient", lookupFields: ["patientId", "phone", "firstName"] } },
  { name: "doctorRef", type: "string", required: true, description: "Doctor identifier (employee ID or name)", foreignKey: { model: "Staff", lookupFields: ["employeeId", "firstName"] } },
  { name: "scheduledDate", type: "date", required: true, description: "Appointment date" },
  { name: "scheduledTime", type: "string", required: true, description: "Time (e.g. 14:30 or 2:30 PM)" },
  { name: "duration", type: "integer", required: false, description: "Duration in minutes (default 30)" },
  { name: "appointmentType", type: "enum", required: false, description: "Type", enumValues: ["CONSULTATION", "PROCEDURE", "FOLLOW_UP", "EMERGENCY", "CHECK_UP"], enumAliases: APPOINTMENT_TYPE_ALIASES },
  { name: "status", type: "enum", required: false, description: "Status", enumValues: ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW", "RESCHEDULED"], enumAliases: APPOINTMENT_STATUS_ALIASES },
  { name: "chiefComplaint", type: "string", required: false, description: "Chief complaint or reason for visit" },
  { name: "notes", type: "string", required: false, description: "Additional notes" },
  { name: "chairNumber", type: "integer", required: false, description: "Chair/room number" },
]

const TREATMENT_FIELDS: FieldDefinition[] = [
  { name: "treatmentNo", type: "string", required: false, description: "Treatment number (auto-generated if blank)" },
  { name: "patientRef", type: "string", required: true, description: "Patient identifier (patient ID, name, or phone)", foreignKey: { model: "Patient", lookupFields: ["patientId", "phone", "firstName"] } },
  { name: "doctorRef", type: "string", required: true, description: "Doctor identifier (employee ID or name)", foreignKey: { model: "Staff", lookupFields: ["employeeId", "firstName"] } },
  { name: "procedureRef", type: "string", required: true, description: "Procedure name or code", foreignKey: { model: "Procedure", lookupFields: ["name", "code"] } },
  { name: "cost", type: "decimal", required: true, description: "Treatment cost" },
  { name: "toothNumbers", type: "string", required: false, description: "Tooth numbers (comma-separated)" },
  { name: "diagnosis", type: "string", required: false, description: "Diagnosis" },
  { name: "findings", type: "string", required: false, description: "Clinical findings" },
  { name: "procedureNotes", type: "string", required: false, description: "Procedure notes" },
  { name: "status", type: "enum", required: false, description: "Status", enumValues: ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"], enumAliases: TREATMENT_STATUS_ALIASES },
  { name: "startTime", type: "datetime", required: false, description: "Treatment start time" },
  { name: "endTime", type: "datetime", required: false, description: "Treatment end time" },
]

const INVOICE_FIELDS: FieldDefinition[] = [
  { name: "invoiceNo", type: "string", required: false, description: "Invoice number (auto-generated if blank)" },
  { name: "patientRef", type: "string", required: true, description: "Patient identifier (patient ID, name, or phone)", foreignKey: { model: "Patient", lookupFields: ["patientId", "phone", "firstName"] } },
  { name: "subtotal", type: "decimal", required: true, description: "Subtotal before tax" },
  { name: "totalAmount", type: "decimal", required: true, description: "Total amount including tax" },
  { name: "paidAmount", type: "decimal", required: false, description: "Amount already paid" },
  { name: "balanceAmount", type: "decimal", required: false, description: "Balance remaining" },
  { name: "taxableAmount", type: "decimal", required: false, description: "Taxable amount (defaults to subtotal)" },
  { name: "cgstAmount", type: "decimal", required: false, description: "CGST amount (defaults to 0)" },
  { name: "sgstAmount", type: "decimal", required: false, description: "SGST amount (defaults to 0)" },
  { name: "discountAmount", type: "decimal", required: false, description: "Discount amount" },
  { name: "status", type: "enum", required: false, description: "Status", enumValues: ["DRAFT", "PENDING", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED", "REFUNDED"], enumAliases: INVOICE_STATUS_ALIASES },
  { name: "dueDate", type: "date", required: false, description: "Payment due date" },
  { name: "notes", type: "string", required: false, description: "Invoice notes" },
]

const PAYMENT_FIELDS: FieldDefinition[] = [
  { name: "paymentNo", type: "string", required: false, description: "Payment number (auto-generated if blank)" },
  { name: "invoiceRef", type: "string", required: true, description: "Invoice number", foreignKey: { model: "Invoice", lookupFields: ["invoiceNo"] } },
  { name: "amount", type: "decimal", required: true, description: "Payment amount" },
  { name: "paymentMethod", type: "enum", required: true, description: "Payment method", enumValues: ["CASH", "CARD", "UPI", "BANK_TRANSFER", "CHEQUE", "INSURANCE", "WALLET", "ONLINE"], enumAliases: PAYMENT_METHOD_ALIASES },
  { name: "paymentDate", type: "date", required: false, description: "Payment date" },
  { name: "transactionId", type: "string", required: false, description: "Transaction/reference ID" },
  { name: "bankName", type: "string", required: false, description: "Bank name" },
  { name: "chequeNumber", type: "string", required: false, description: "Cheque number" },
  { name: "upiId", type: "string", required: false, description: "UPI ID" },
  { name: "status", type: "enum", required: false, description: "Status", enumValues: ["PENDING", "COMPLETED", "FAILED", "REFUNDED", "CANCELLED"], enumAliases: PAYMENT_STATUS_ALIASES },
  { name: "notes", type: "string", required: false, description: "Payment notes" },
]

const INVENTORY_FIELDS: FieldDefinition[] = [
  { name: "sku", type: "string", required: false, description: "Stock Keeping Unit code (auto-generated if blank)" },
  { name: "name", type: "string", required: true, description: "Item name" },
  { name: "unit", type: "string", required: true, description: "Unit of measurement (e.g. pieces, boxes, ml)" },
  { name: "purchasePrice", type: "decimal", required: true, description: "Purchase price per unit" },
  { name: "sellingPrice", type: "decimal", required: false, description: "Selling price per unit" },
  { name: "currentStock", type: "integer", required: false, description: "Current stock quantity" },
  { name: "minimumStock", type: "integer", required: false, description: "Minimum stock level for alerts" },
  { name: "reorderLevel", type: "integer", required: false, description: "Reorder level" },
  { name: "manufacturer", type: "string", required: false, description: "Manufacturer name" },
  { name: "description", type: "string", required: false, description: "Item description" },
  { name: "storageLocation", type: "string", required: false, description: "Storage location (e.g. Shelf A1)" },
  { name: "storageConditions", type: "string", required: false, description: "Storage conditions (e.g. Room Temperature)" },
]

// ---------------------------------------------------------------------------
// Master registry
// ---------------------------------------------------------------------------
export const ENTITY_SCHEMAS: Record<string, EntitySchema> = {
  patients: {
    entityType: "patients",
    prismaModel: "Patient",
    label: "Patients",
    description: "Patient demographics and contact information",
    uniqueKey: ["patientId"],
    autoGenerateId: "patientId",
    autoGeneratePrefix: "PAT",
    fields: PATIENT_FIELDS,
  },
  staff: {
    entityType: "staff",
    prismaModel: "Staff",
    label: "Staff",
    description: "Doctors, nurses, receptionists, and other staff",
    uniqueKey: ["employeeId"],
    autoGenerateId: "employeeId",
    autoGeneratePrefix: "EMP",
    fields: STAFF_FIELDS,
  },
  appointments: {
    entityType: "appointments",
    prismaModel: "Appointment",
    label: "Appointments",
    description: "Scheduled appointments with patients and doctors",
    uniqueKey: ["appointmentNo"],
    autoGenerateId: "appointmentNo",
    autoGeneratePrefix: "APT",
    fields: APPOINTMENT_FIELDS,
  },
  treatments: {
    entityType: "treatments",
    prismaModel: "Treatment",
    label: "Treatments",
    description: "Treatment records with procedures and costs",
    uniqueKey: ["treatmentNo"],
    autoGenerateId: "treatmentNo",
    autoGeneratePrefix: "TRT",
    fields: TREATMENT_FIELDS,
  },
  invoices: {
    entityType: "invoices",
    prismaModel: "Invoice",
    label: "Invoices",
    description: "Billing invoices with amounts and status",
    uniqueKey: ["invoiceNo"],
    autoGenerateId: "invoiceNo",
    autoGeneratePrefix: "INV",
    fields: INVOICE_FIELDS,
  },
  payments: {
    entityType: "payments",
    prismaModel: "Payment",
    label: "Payments",
    description: "Payment transactions against invoices",
    uniqueKey: ["paymentNo"],
    autoGenerateId: "paymentNo",
    autoGeneratePrefix: "PAY",
    fields: PAYMENT_FIELDS,
  },
  inventory: {
    entityType: "inventory",
    prismaModel: "InventoryItem",
    label: "Inventory",
    description: "Inventory items with stock levels and pricing",
    uniqueKey: ["sku"],
    autoGenerateId: "sku",
    autoGeneratePrefix: "SKU",
    fields: INVENTORY_FIELDS,
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve an enum value using exact match, aliases, then case-insensitive match */
export function resolveEnum(
  value: string,
  enumValues: string[],
  aliases?: Record<string, string>
): string | null {
  if (!value) return null
  const trimmed = value.trim()

  // Exact match
  if (enumValues.includes(trimmed)) return trimmed

  // Alias match
  if (aliases && aliases[trimmed]) return aliases[trimmed]

  // Case-insensitive match
  const upper = trimmed.toUpperCase().replace(/[\s-]+/g, "_")
  const match = enumValues.find((e) => e === upper)
  if (match) return match

  // Alias case-insensitive
  if (aliases) {
    for (const [key, val] of Object.entries(aliases)) {
      if (key.toLowerCase() === trimmed.toLowerCase()) return val
    }
  }

  return null
}

/** Try to parse a date string in common Indian/international formats */
export function parseDate(value: string): Date | null {
  if (!value) return null
  const trimmed = value.trim()

  // ISO: 2025-02-17
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const d = new Date(trimmed)
    if (!isNaN(d.getTime())) return d
  }

  // DD/MM/YYYY or DD-MM-YYYY (Indian standard — try first)
  const ddmm = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (ddmm) {
    const [, day, month, year] = ddmm
    const d = new Date(+year, +month - 1, +day)
    if (!isNaN(d.getTime()) && d.getDate() === +day) return d
  }

  // DD MMM YYYY (e.g., 17 Feb 2025)
  const ddmmm = trimmed.match(/^(\d{1,2})\s+(\w{3,})\s+(\d{4})$/)
  if (ddmmm) {
    const d = new Date(trimmed)
    if (!isNaN(d.getTime())) return d
  }

  // Fallback: let JS parse it
  const d = new Date(trimmed)
  if (!isNaN(d.getTime())) return d

  return null
}

/** Coerce a string value to the target field type */
export function coerceValue(
  value: string,
  field: FieldDefinition
): { value: any; error?: string } {
  const trimmed = (value ?? "").trim()

  if (!trimmed) {
    if (field.required) return { value: null, error: `${field.name} is required` }
    return { value: null }
  }

  switch (field.type) {
    case "string":
      if (field.maxLength && trimmed.length > field.maxLength) {
        return { value: trimmed.slice(0, field.maxLength), error: `Truncated to ${field.maxLength} chars` }
      }
      if (field.pattern && !field.pattern.test(trimmed)) {
        return { value: trimmed, error: `Invalid format for ${field.name}` }
      }
      return { value: trimmed }

    case "integer": {
      const n = parseInt(trimmed.replace(/,/g, ""), 10)
      if (isNaN(n)) return { value: null, error: `"${trimmed}" is not a valid number` }
      return { value: n }
    }

    case "decimal": {
      const n = parseFloat(trimmed.replace(/,/g, "").replace(/[^\d.-]/g, ""))
      if (isNaN(n)) return { value: null, error: `"${trimmed}" is not a valid number` }
      return { value: Math.round(n * 100) / 100 }
    }

    case "date": {
      const d = parseDate(trimmed)
      if (!d) return { value: null, error: `"${trimmed}" is not a valid date` }
      return { value: d }
    }

    case "datetime": {
      const d = new Date(trimmed)
      if (isNaN(d.getTime())) return { value: null, error: `"${trimmed}" is not a valid date/time` }
      return { value: d }
    }

    case "boolean": {
      const lower = trimmed.toLowerCase()
      if (["true", "yes", "1", "y"].includes(lower)) return { value: true }
      if (["false", "no", "0", "n"].includes(lower)) return { value: false }
      return { value: null, error: `"${trimmed}" is not a valid boolean` }
    }

    case "enum": {
      const resolved = resolveEnum(trimmed, field.enumValues || [], field.enumAliases)
      if (!resolved) {
        return { value: null, error: `"${trimmed}" doesn't match any ${field.name} option (${field.enumValues?.join(", ")})` }
      }
      return { value: resolved }
    }

    default:
      return { value: trimmed }
  }
}
