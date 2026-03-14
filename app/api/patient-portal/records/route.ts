import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePatientAuth } from "@/lib/patient-auth"

/**
 * GET: Patient's treatment records, dental chart entries, and documents.
 */
export async function GET(req: NextRequest) {
  const { error, patient } = await requirePatientAuth(req)
  if (error) return error

  try {
    const { searchParams } = new URL(req.url)
    const tab = searchParams.get("tab") || "treatments" // treatments | chart | documents

    if (tab === "treatments") {
      const treatments = await prisma.treatment.findMany({
        where: {
          patientId: patient!.id,
          hospitalId: patient!.hospitalId,
        },
        include: {
          procedure: { select: { name: true, code: true, category: true } },
          doctor: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
      })
      return NextResponse.json({ treatments })
    }

    if (tab === "chart") {
      const chartEntries = await prisma.dentalChartEntry.findMany({
        where: {
          patientId: patient!.id,
          hospitalId: patient!.hospitalId,
        },
        orderBy: { createdAt: "desc" },
      })
      return NextResponse.json({ chartEntries })
    }

    if (tab === "documents") {
      const documents = await prisma.document.findMany({
        where: {
          patientId: patient!.id,
          hospitalId: patient!.hospitalId,
        },
        select: {
          id: true,
          fileName: true,
          originalName: true,
          fileType: true,
          documentType: true,
          fileSize: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      })
      return NextResponse.json({ documents })
    }

    return NextResponse.json({ error: "Invalid tab" }, { status: 400 })
  } catch (err: unknown) {
    console.error("Patient records error:", err)
    return NextResponse.json(
      { error: "Failed to load records" },
      { status: 500 }
    )
  }
}
