import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// GET - Single plan with enrolled patients
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params

    const plan = await prisma.membershipPlan.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            patient: {
              select: { id: true, patientId: true, firstName: true, lastName: true, phone: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { memberships: true } },
      },
    })

    if (!plan || plan.hospitalId !== hospitalId) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    return NextResponse.json(plan)
  } catch (err) {
    console.error("Error fetching plan:", err)
    return NextResponse.json({ error: "Failed to fetch plan" }, { status: 500 })
  }
}

// PUT - Update plan
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can update plans" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const updated = await prisma.membershipPlan.updateMany({
      where: { id, hospitalId },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.price !== undefined && { price: body.price }),
        ...(body.duration !== undefined && { duration: body.duration }),
        ...(body.benefits !== undefined && { benefits: body.benefits }),
        ...(body.maxMembers !== undefined && { maxMembers: body.maxMembers }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    })

    if (updated.count === 0) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    const plan = await prisma.membershipPlan.findUnique({ where: { id } })
    return NextResponse.json(plan)
  } catch (err) {
    console.error("Error updating plan:", err)
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 })
  }
}

// DELETE - Delete plan (only if no active memberships)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can delete plans" }, { status: 403 })
    }

    const { id } = await params

    const plan = await prisma.membershipPlan.findUnique({
      where: { id },
      include: { _count: { select: { memberships: true } } },
    })

    if (!plan || plan.hospitalId !== hospitalId) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    if (plan._count.memberships > 0) {
      // Soft delete — deactivate
      await prisma.membershipPlan.update({
        where: { id },
        data: { isActive: false },
      })
      return NextResponse.json({ message: "Plan deactivated (has existing memberships)" })
    }

    await prisma.membershipPlan.delete({ where: { id } })
    return NextResponse.json({ message: "Plan deleted" })
  } catch (err) {
    console.error("Error deleting plan:", err)
    return NextResponse.json({ error: "Failed to delete plan" }, { status: 500 })
  }
}
