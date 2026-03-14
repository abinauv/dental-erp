/**
 * Internal event dispatcher for AI-driven workflow triggers (Phase 4.6).
 *
 * Events:
 *   treatment.completed      → Invoice recommendation insight
 *   appointment.no_show      → Re-engagement insight
 *   inventory.below_reorder  → Purchase order insight
 *   lab_order.delayed        → Delay alert insight
 *   payment.received         → Insurance verification insight (amounts > ₹5 000)
 *   patient.created          → Onboarding insight
 *
 * Each event is logged as an AISkillExecution and produces an AIInsight
 * that surfaces in the Insights Panel on the dashboard.
 */

import { prisma } from "@/lib/prisma"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type EventType =
  | "treatment.completed"
  | "appointment.no_show"
  | "inventory.below_reorder"
  | "lab_order.delayed"
  | "payment.received"
  | "patient.created"

export interface DispatchPayload {
  type: EventType
  hospitalId: string
  payload: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Entry-point
// ---------------------------------------------------------------------------
export async function dispatchEvent({ type, hospitalId, payload }: DispatchPayload) {
  // Log start
  const execution = await prisma.aISkillExecution.create({
    data: {
      hospitalId,
      skill: `event.${type}`,
      input: payload as object,
      output: {} as object,
      status: "RUNNING",
    },
  })

  try {
    switch (type) {
      case "treatment.completed":      await onTreatmentCompleted(hospitalId, payload); break
      case "appointment.no_show":      await onAppointmentNoShow(hospitalId, payload); break
      case "inventory.below_reorder":  await onInventoryBelowReorder(hospitalId, payload); break
      case "lab_order.delayed":        await onLabOrderDelayed(hospitalId, payload); break
      case "payment.received":         await onPaymentReceived(hospitalId, payload); break
      case "patient.created":          await onPatientCreated(hospitalId, payload); break
    }

    await prisma.aISkillExecution.update({
      where: { id: execution.id },
      data: { status: "COMPLETED", output: { handled: true } as object },
    })
  } catch (err) {
    await prisma.aISkillExecution.update({
      where: { id: execution.id },
      data: { status: "FAILED", error: String(err), output: {} as object },
    })
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function insightExpiry(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000)
}

async function createInsight(
  hospitalId: string,
  category: string,
  severity: string,
  title: string,
  description: string,
  data: Record<string, unknown>,
  ttlHours = 48
) {
  return prisma.aIInsight.create({
    data: {
      hospitalId,
      category: category as "REVENUE" | "CLINICAL" | "OPERATIONAL" | "PATIENT" | "STAFFING" | "INVENTORY",
      severity: severity as "INFO" | "WARNING" | "CRITICAL",
      title,
      description,
      data: data as object,
      expiresAt: insightExpiry(ttlHours),
    },
  })
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------
async function onTreatmentCompleted(hospitalId: string, payload: Record<string, unknown>) {
  await createInsight(
    hospitalId, "REVENUE", "INFO",
    "Treatment Completed — Invoice Recommended",
    `Treatment ${payload.treatmentId} for patient ${payload.patientName || payload.patientId} is complete. Generate an invoice for the unbilled procedures.`,
    payload, 24
  )
}

async function onAppointmentNoShow(hospitalId: string, payload: Record<string, unknown>) {
  await createInsight(
    hospitalId, "PATIENT", "WARNING",
    "Appointment No-Show — Re-engagement",
    `${payload.patientName || "Patient"} missed their appointment on ${payload.appointmentDate || "today"}. Send a re-engagement message to reschedule.`,
    payload, 72
  )
}

async function onInventoryBelowReorder(hospitalId: string, payload: Record<string, unknown>) {
  const isZero = Number(payload.currentStock) === 0
  await createInsight(
    hospitalId, "INVENTORY", isZero ? "CRITICAL" : "WARNING",
    `${isZero ? "Out of Stock" : "Low Stock"}: ${payload.itemName}`,
    `${payload.itemName} — current stock: ${payload.currentStock}, reorder level: ${payload.reorderLevel}. A purchase order is recommended.`,
    payload, 72
  )
}

async function onLabOrderDelayed(hospitalId: string, payload: Record<string, unknown>) {
  await createInsight(
    hospitalId, "OPERATIONAL", "CRITICAL",
    "Lab Order Delayed",
    `Order from ${payload.vendorName || "vendor"} (expected ${payload.expectedDate}) is delayed. Alert the treating doctor and consider rescheduling the fitting appointment.`,
    payload, 48
  )
}

async function onPaymentReceived(hospitalId: string, payload: Record<string, unknown>) {
  if (Number(payload.amount || 0) > 5000) {
    await createInsight(
      hospitalId, "REVENUE", "INFO",
      "Large Payment Received",
      `₹${payload.amount} received for invoice ${payload.invoiceId}. Verify insurance claim reconciliation if applicable.`,
      payload, 24
    )
  }
}

async function onPatientCreated(hospitalId: string, payload: Record<string, unknown>) {
  await createInsight(
    hospitalId, "PATIENT", "INFO",
    `New Patient: ${payload.patientName || "New Patient"}`,
    `${payload.patientName || "A new patient"} has been registered. Send a welcome message with clinic details and appointment booking info.`,
    payload, 168 // 7 days
  )
}
