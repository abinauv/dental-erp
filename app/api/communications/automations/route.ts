import { NextResponse } from "next/server"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/communications/automations
 * List all marketing automation rules for the hospital
 */
export async function GET(req: Request) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error) return error

  const automations = await prisma.marketingAutomation.findMany({
    where: { hospitalId: hospitalId! },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ automations })
}

/**
 * POST /api/communications/automations
 * Create a new automation rule
 */
export async function POST(req: Request) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error) return error

  const body = await req.json()
  const { name, trigger, action, isActive } = body

  if (!name || !trigger || !action) {
    return NextResponse.json(
      { error: "Name, trigger, and action are required" },
      { status: 400 }
    )
  }

  // Validate trigger structure
  const validTriggers = [
    "NO_VISIT",
    "BIRTHDAY_UPCOMING",
    "TREATMENT_PLAN_PENDING",
    "MEMBERSHIP_EXPIRING",
    "POST_APPOINTMENT",
    "PAYMENT_OVERDUE",
  ]
  if (!trigger.type || !validTriggers.includes(trigger.type)) {
    return NextResponse.json(
      { error: `Invalid trigger type. Valid: ${validTriggers.join(", ")}` },
      { status: 400 }
    )
  }

  // Validate action structure
  const validActions = ["SEND_SMS", "SEND_EMAIL", "CREATE_NOTIFICATION", "ADD_TO_SEGMENT"]
  if (!action.type || !validActions.includes(action.type)) {
    return NextResponse.json(
      { error: `Invalid action type. Valid: ${validActions.join(", ")}` },
      { status: 400 }
    )
  }

  const automation = await prisma.marketingAutomation.create({
    data: {
      hospitalId: hospitalId!,
      name,
      trigger,
      action,
      isActive: isActive ?? true,
    },
  })

  return NextResponse.json({ automation }, { status: 201 })
}

/**
 * PUT /api/communications/automations
 * Update an existing automation rule (pass id in body)
 */
export async function PUT(req: Request) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error) return error

  const body = await req.json()
  const { id, name, trigger, action, isActive } = body

  if (!id) {
    return NextResponse.json({ error: "Automation id is required" }, { status: 400 })
  }

  // Verify ownership
  const existing = await prisma.marketingAutomation.findFirst({
    where: { id, hospitalId: hospitalId! },
  })
  if (!existing) {
    return NextResponse.json({ error: "Automation not found" }, { status: 404 })
  }

  const updateData: Record<string, unknown> = {}
  if (name !== undefined) updateData.name = name
  if (trigger !== undefined) updateData.trigger = trigger
  if (action !== undefined) updateData.action = action
  if (isActive !== undefined) updateData.isActive = isActive

  const automation = await prisma.marketingAutomation.update({
    where: { id },
    data: updateData,
  })

  return NextResponse.json({ automation })
}

/**
 * DELETE /api/communications/automations
 * Delete an automation rule (pass id in body)
 */
export async function DELETE(req: Request) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error) return error

  const body = await req.json()
  const { id } = body

  if (!id) {
    return NextResponse.json({ error: "Automation id is required" }, { status: 400 })
  }

  // Verify ownership
  const existing = await prisma.marketingAutomation.findFirst({
    where: { id, hospitalId: hospitalId! },
  })
  if (!existing) {
    return NextResponse.json({ error: "Automation not found" }, { status: 404 })
  }

  await prisma.marketingAutomation.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
