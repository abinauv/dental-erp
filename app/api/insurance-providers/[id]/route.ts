import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN", "ACCOUNTANT"])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const provider = await prisma.insuranceProviderMaster.findFirst({
    where: { id, hospitalId },
    include: {
      policies: {
        include: {
          patient: { select: { id: true, patientId: true, firstName: true, lastName: true } },
        },
        where: { isActive: true },
        take: 20,
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { policies: true } },
    },
  })

  if (!provider) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 })
  }

  return NextResponse.json(provider)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const body = await req.json()
    const { name, code, contactPhone, contactEmail, website, claimSubmissionUrl, portalUsername, portalPassword, isActive } = body

    const provider = await prisma.insuranceProviderMaster.updateMany({
      where: { id, hospitalId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(code !== undefined && { code: code?.trim() || null }),
        ...(contactPhone !== undefined && { contactPhone: contactPhone?.trim() || null }),
        ...(contactEmail !== undefined && { contactEmail: contactEmail?.trim() || null }),
        ...(website !== undefined && { website: website?.trim() || null }),
        ...(claimSubmissionUrl !== undefined && { claimSubmissionUrl: claimSubmissionUrl?.trim() || null }),
        ...(portalUsername !== undefined && { portalUsername: portalUsername?.trim() || null }),
        ...(portalPassword !== undefined && { portalPassword: portalPassword?.trim() || null }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    if (provider.count === 0) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "A provider with this name already exists" }, { status: 409 })
    }
    console.error("Update insurance provider error:", err)
    return NextResponse.json({ error: "Failed to update provider" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const policyCount = await prisma.patientInsurance.count({
    where: { providerId: id, hospitalId },
  })

  if (policyCount > 0) {
    // Soft-delete by deactivating
    await prisma.insuranceProviderMaster.updateMany({
      where: { id, hospitalId },
      data: { isActive: false },
    })
    return NextResponse.json({ message: "Provider deactivated (has linked policies)" })
  }

  await prisma.insuranceProviderMaster.deleteMany({
    where: { id, hospitalId },
  })

  return NextResponse.json({ message: "Provider deleted" })
}
