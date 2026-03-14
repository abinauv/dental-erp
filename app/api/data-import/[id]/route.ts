import { NextRequest, NextResponse } from "next/server"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error || !hospitalId) return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const job = await prisma.dataImportJob.findFirst({
    where: { id, hospitalId },
    include: { user: { select: { name: true, email: true } } },
  })

  if (!job) return NextResponse.json({ error: "Import job not found" }, { status: 404 })

  return NextResponse.json({ job })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error || !hospitalId) return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const job = await prisma.dataImportJob.findFirst({
    where: { id, hospitalId },
  })

  if (!job) return NextResponse.json({ error: "Import job not found" }, { status: 404 })

  await prisma.dataImportJob.update({
    where: { id },
    data: { status: "CANCELLED" },
  })

  return NextResponse.json({ success: true })
}
