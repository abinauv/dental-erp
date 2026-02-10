import { NextRequest, NextResponse } from "next/server"
import { requireAuthAndRole } from "@/lib/api-helpers"
import prisma from "@/lib/prisma"

// PUT /api/patients/[id]/documents/[documentId]/annotations — Save annotations
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    if (!["ADMIN", "DOCTOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Only doctors and admins can annotate" }, { status: 403 })
    }

    const { id, documentId } = await params
    const body = await req.json()
    const { annotations } = body

    if (!Array.isArray(annotations)) {
      return NextResponse.json({ error: "annotations must be an array" }, { status: 400 })
    }

    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        patientId: id,
        hospitalId,
      },
    })

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const updated = await prisma.document.update({
      where: { id: documentId },
      data: {
        annotations: annotations,
        annotatedBy: session.user.id,
        annotatedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      annotations: updated.annotations,
      annotatedBy: updated.annotatedBy,
      annotatedAt: updated.annotatedAt,
    })
  } catch (err) {
    console.error("Error saving annotations:", err)
    return NextResponse.json({ error: "Failed to save annotations" }, { status: 500 })
  }
}

// GET /api/patients/[id]/documents/[documentId]/annotations — Get annotations
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id, documentId } = await params

    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        patientId: id,
        hospitalId,
      },
      select: {
        annotations: true,
        annotatedBy: true,
        annotatedAt: true,
      },
    })

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    return NextResponse.json({
      annotations: document.annotations || [],
      annotatedBy: document.annotatedBy,
      annotatedAt: document.annotatedAt,
    })
  } catch (err) {
    console.error("Error fetching annotations:", err)
    return NextResponse.json({ error: "Failed to fetch annotations" }, { status: 500 })
  }
}
