import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

export async function GET(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN", "ACCOUNTANT"])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search")?.trim() || ""
  const activeOnly = searchParams.get("activeOnly") === "true"

  const where: any = { hospitalId }
  if (activeOnly) where.isActive = true
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { code: { contains: search } },
      { contactEmail: { contains: search } },
    ]
  }

  const providers = await prisma.insuranceProviderMaster.findMany({
    where,
    include: {
      _count: { select: { policies: true } },
    },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(providers)
}

export async function POST(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { name, code, contactPhone, contactEmail, website, claimSubmissionUrl, portalUsername, portalPassword } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: "Provider name is required" }, { status: 400 })
    }

    const provider = await prisma.insuranceProviderMaster.create({
      data: {
        hospitalId,
        name: name.trim(),
        code: code?.trim() || null,
        contactPhone: contactPhone?.trim() || null,
        contactEmail: contactEmail?.trim() || null,
        website: website?.trim() || null,
        claimSubmissionUrl: claimSubmissionUrl?.trim() || null,
        portalUsername: portalUsername?.trim() || null,
        portalPassword: portalPassword?.trim() || null,
      },
    })

    return NextResponse.json(provider, { status: 201 })
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "A provider with this name already exists" }, { status: 409 })
    }
    console.error("Create insurance provider error:", err)
    return NextResponse.json({ error: "Failed to create provider" }, { status: 500 })
  }
}
