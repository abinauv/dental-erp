/**
 * POST /api/ai/clinical
 *
 * Multi-purpose clinical AI endpoint.  Dispatches on `type`:
 *   patient_summary   – 360° patient summary card
 *   drug_check        – drug-interaction & allergy check
 *   cost_estimate     – procedure cost breakdown
 *   consent_form      – procedure-specific consent form (multi-language)
 *   clinical_notes    – expand brief notes into structured documentation
 *   duplicate_check   – fuzzy duplicate-patient detection
 *   audit_analysis    – audit-log pattern analysis
 *
 * All types require an authenticated session.  Clinical types (patient_summary,
 * drug_check) use the "clinical" model tier for highest accuracy.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { prisma } from "@/lib/prisma"
import { complete, extractJSON } from "@/lib/ai/openrouter"
import { getModelByTier } from "@/lib/ai/models"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function safeParseJSON(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(extractJSON(raw))
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error) return error

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  switch (body.type) {
    case "patient_summary":   return patientSummary(hospitalId!, body)
    case "drug_check":        return drugCheck(hospitalId!, body)
    case "cost_estimate":     return costEstimate(hospitalId!, body)
    case "consent_form":      return consentForm(hospitalId!, body)
    case "clinical_notes":    return clinicalNotes(hospitalId!, body)
    case "duplicate_check":   return duplicateCheck(hospitalId!, body)
    case "audit_analysis":    return auditAnalysis(hospitalId!, body)
    default:
      return NextResponse.json({ error: "Unknown clinical type" }, { status: 400 })
  }
}

// ---------------------------------------------------------------------------
// patient_summary
// ---------------------------------------------------------------------------
async function patientSummary(hospitalId: string, body: Record<string, unknown>) {
  const patientId = body.patientId as string
  const refresh = body.refresh === true
  if (!patientId) return NextResponse.json({ error: "patientId required" }, { status: 400 })

  const patient = await prisma.patient.findFirst({ where: { id: patientId, hospitalId } })
  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 })

  // Return cached summary if available and not force-refreshing
  if (!refresh && patient.aiSummary && patient.aiSummaryAt) {
    return NextResponse.json({ success: true, data: patient.aiSummary, cached: true })
  }

  // Parallel fetch of related data
  const [appointments, treatments, invoices, riskScores] = await Promise.all([
    prisma.appointment.findMany({ where: { patientId, hospitalId }, orderBy: { scheduledDate: "desc" }, take: 5 }),
    prisma.treatment.findMany({ where: { patientId, hospitalId }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.invoice.findMany({ where: { patientId, hospitalId }, take: 10 }),
    prisma.patientRiskScore.findMany({ where: { patientId, hospitalId }, orderBy: { calculatedAt: "desc" }, take: 1 }),
  ])

  const outstandingBalance = invoices
    .filter((inv) => inv.status === "PENDING" || inv.status === "OVERDUE")
    .reduce((sum, inv) => sum + Number(inv.totalAmount || 0) - Number(inv.paidAmount || 0), 0)

  const snapshot = {
    name: `${patient.firstName} ${patient.lastName}`,
    age: patient.age,
    phone: patient.phone,
    lastVisit: appointments[0]?.scheduledDate ?? null,
    recentAppointments: appointments.slice(0, 3).map((a) => ({ date: a.scheduledDate, type: a.appointmentType, status: a.status })),
    recentTreatments: treatments.slice(0, 3).map((t) => ({ status: t.status, createdAt: t.createdAt })),
    outstandingBalance,
    riskScore: riskScores[0]?.overallScore ?? null,
    riskFactors: riskScores[0]?.factors ?? null,
  }

  try {
    const response = await complete(
      [
        {
          role: "system",
          content:
            'Generate a concise 360° patient summary for a dental clinic. Include key demographics, visit history, financial status, and clinical flags.\n\nOutput valid JSON ONLY (no markdown, no explanation):\n{"summary":"one-paragraph overview","highlights":["key point 1","key point 2"],"flags":["allergy or risk 1"],"lastVisit":"human-readable date or \'No recent visit\'","nextAction":"recommended next step"}',
        },
        { role: "user", content: JSON.stringify(snapshot) },
      ],
      getModelByTier("clinical")
    )

    const data = safeParseJSON(response.content) ?? { summary: response.content }

    // Cache the generated summary in the patient record
    await prisma.patient.update({
      where: { id: patientId },
      data: { aiSummary: data as any, aiSummaryAt: new Date() },
    })

    return NextResponse.json({ success: true, data, cached: false })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// drug_check
// ---------------------------------------------------------------------------
async function drugCheck(hospitalId: string, body: Record<string, unknown>) {
  const patientId = body.patientId as string
  const medications = (body.medications as string[]) || []
  const newMedication = body.newMedication as string

  const patient = await prisma.patient.findFirst({ where: { id: patientId, hospitalId } })

  try {
    const response = await complete(
      [
        {
          role: "system",
          content:
            "You are a pharmaceutical interaction checker for a dental clinic. Check for drug interactions, contraindications, and allergies.\n\nOutput valid JSON ONLY:\n{\"safe\":true,\"interactions\":[{\"drugs\":\"drug A + drug B\",\"severity\":\"low|moderate|high\",\"description\":\"...\"}],\"allergies\":[{\"allergen\":\"...\",\"reaction\":\"...\"}],\"recommendations\":[\"...\"]}\n\nIMPORTANT: This output is for doctor review only — not a diagnosis or prescription.",
        },
        {
          role: "user",
          content: JSON.stringify({
            patient: patient ? { name: `${patient.firstName} ${patient.lastName}` } : null,
            currentMedications: medications,
            newMedication,
          }),
        },
      ],
      getModelByTier("clinical")
    )

    const data = safeParseJSON(response.content) ?? { safe: true, interactions: [], recommendations: [] }
    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// cost_estimate
// ---------------------------------------------------------------------------
async function costEstimate(hospitalId: string, body: Record<string, unknown>) {
  const procedureIds = (body.procedureIds as string[]) || []
  const treatmentPlan = (body.treatmentPlan as string) || ""

  const procedures = procedureIds.length
    ? await prisma.procedure.findMany({ where: { id: { in: procedureIds }, hospitalId } })
    : []

  try {
    const response = await complete(
      [
        {
          role: "system",
          content:
            "Generate a dental treatment cost breakdown. Include base costs, materials estimate, and GST at 12%.\n\nOutput valid JSON ONLY:\n{\"lineItems\":[{\"description\":\"...\",\"quantity\":1,\"unitCost\":0,\"total\":0}],\"subtotal\":0,\"gst\":0,\"grandTotal\":0,\"notes\":\"...\"}",
        },
        {
          role: "user",
          content: JSON.stringify({
            procedures: procedures.map((p) => ({ name: p.name, category: p.category, basePrice: p.basePrice })),
            notes: treatmentPlan,
          }),
        },
      ],
      getModelByTier("reports")
    )

    const data = safeParseJSON(response.content) ?? { lineItems: [], subtotal: 0, gst: 0, grandTotal: 0 }
    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// consent_form
// ---------------------------------------------------------------------------
async function consentForm(hospitalId: string, body: Record<string, unknown>) {
  const patientId = body.patientId as string
  const procedureName = (body.procedureName as string) || ""
  const procedureId = body.procedureId as string | undefined
  const language = (body.language as string) || "English"

  const [patient, procedure, hospital] = await Promise.all([
    patientId ? prisma.patient.findFirst({ where: { id: patientId, hospitalId }, select: { firstName: true, lastName: true } }) : null,
    procedureId ? prisma.procedure.findFirst({ where: { id: procedureId, hospitalId } }) : null,
    prisma.hospital.findUnique({ where: { id: hospitalId }, select: { name: true } }),
  ])

  try {
    const response = await complete(
      [
        {
          role: "system",
          content: `Generate a dental procedure consent form in ${language}. Include: procedure description, potential risks, benefits, alternatives, and patient acknowledgement.\n\nOutput valid JSON ONLY:\n{"title":"...","patientName":"...","hospitalName":"...","procedureName":"...","description":"...","risks":["..."],"benefits":["..."],"alternatives":["..."],"acknowledgement":"..."}`,
        },
        {
          role: "user",
          content: JSON.stringify({
            patient: patient ? `${patient.firstName} ${patient.lastName}` : "Patient",
            hospital: hospital?.name || "Dental Clinic",
            procedure: procedure?.name || procedureName || "Procedure",
            procedureDescription: procedure?.description || "",
          }),
        },
      ],
      getModelByTier("reports")
    )

    const data = safeParseJSON(response.content) ?? { title: "Consent Form", description: response.content }
    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// clinical_notes
// ---------------------------------------------------------------------------
async function clinicalNotes(_hospitalId: string, body: Record<string, unknown>) {
  const briefNotes = (body.briefNotes as string) || ""
  const procedureName = (body.procedureName as string) || ""
  const diagnosis = (body.diagnosis as string) || ""
  const findings = (body.findings as string) || ""

  try {
    const response = await complete(
      [
        {
          role: "system",
          content:
            "Expand brief dental clinical notes into structured documentation using proper dental/medical terminology.\n\nOutput valid JSON ONLY:\n{\"expandedNotes\":\"...\",\"diagnosis\":\"...\",\"findings\":\"...\",\"procedureNotes\":\"...\",\"recommendations\":\"...\"}\n\nIMPORTANT: Only elaborate on what was provided. Do not fabricate clinical findings. All output is AI-assisted and must be reviewed.",
        },
        { role: "user", content: JSON.stringify({ briefNotes, procedureName, diagnosis, findings }) },
      ],
      getModelByTier("reports")
    )

    const data = safeParseJSON(response.content) ?? { expandedNotes: response.content }
    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// duplicate_check
// ---------------------------------------------------------------------------
async function duplicateCheck(hospitalId: string, body: Record<string, unknown>) {
  const firstName = (body.firstName as string) || ""
  const lastName  = (body.lastName as string)  || ""
  const phone     = body.phone as string | undefined
  const email     = body.email as string | undefined
  const dateOfBirth = body.dateOfBirth as string | undefined

  const orClauses: Record<string, unknown>[] = []
  if (phone)                orClauses.push({ phone })
  if (email)                orClauses.push({ email })
  if (firstName && lastName)
    orClauses.push({
      firstName: { contains: firstName.slice(0, 3) },
      lastName:  { contains: lastName.slice(0, 3) },
    })

  if (orClauses.length === 0) return NextResponse.json({ success: true, duplicates: [] })

  const candidates = await prisma.patient.findMany({
    where: { hospitalId, OR: orClauses as any[] },
    select: { id: true, patientId: true, firstName: true, lastName: true, phone: true, email: true, dateOfBirth: true },
    take: 10,
  })

  if (candidates.length === 0) return NextResponse.json({ success: true, duplicates: [] })

  try {
    const response = await complete(
      [
        {
          role: "system",
          content:
            'Score similarity between a new patient record and candidate records.\n\nOutput valid JSON ONLY:\n{"duplicates":[{"id":"...","patientId":"...","name":"First Last","confidence":0.85,"matchFields":["phone","name"]}]}\n\nOnly include candidates with confidence >= 0.6.  confidence is 0–1.',
        },
        {
          role: "user",
          content: JSON.stringify({
            newPatient: { firstName, lastName, phone, email, dateOfBirth },
            candidates,
          }),
        },
      ],
      getModelByTier("query")
    )

    const data = safeParseJSON(response.content) ?? { duplicates: [] }
    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// audit_analysis
// ---------------------------------------------------------------------------
async function auditAnalysis(hospitalId: string, body: Record<string, unknown>) {
  const daysBack = Number(body.daysBack) || 7
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)

  const logs = await prisma.auditLog.findMany({
    where: { hospitalId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { action: true, userId: true, createdAt: true, details: true },
  })

  try {
    const response = await complete(
      [
        {
          role: "system",
          content:
            'You are an audit-log intelligence system. Analyse the logs for suspicious patterns: unusual access hours, bulk data exports, repeated failures, privilege escalation, abnormal volume.\n\nOutput valid JSON ONLY:\n{"suspicious":[{"pattern":"description","severity":"low|medium|high","affectedUsers":["..."],"occurrences":0,"recommendation":"..."}],"summary":"brief overall assessment"}',
        },
        {
          role: "user",
          content: `Last ${daysBack} days of audit logs:\n${JSON.stringify(logs)}`,
        },
      ],
      getModelByTier("insights")
    )

    const data = safeParseJSON(response.content) ?? { suspicious: [], summary: "Analysis unavailable" }
    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
