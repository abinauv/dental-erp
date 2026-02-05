import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// GET - Get dental chart entries for a patient
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get("patientId")
    const toothNumber = searchParams.get("toothNumber")
    const condition = searchParams.get("condition")
    const isActive = searchParams.get("isActive")

    if (!patientId) {
      return NextResponse.json(
        { error: "Patient ID is required" },
        { status: 400 }
      )
    }

    // Verify patient belongs to this hospital
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospitalId }
    })

    if (!patient) {
      return NextResponse.json(
        { error: "Patient not found" },
        { status: 404 }
      )
    }

    // Build where clause
    const where: any = {
      patientId,
      hospitalId
    }

    if (toothNumber) {
      where.toothNumber = parseInt(toothNumber)
    }

    if (condition) {
      where.condition = condition
    }

    // Filter by resolved status if provided
    if (isActive !== null && isActive !== "") {
      if (isActive === "true") {
        // Active = not resolved (no resolvedDate)
        where.resolvedDate = null
      } else {
        // Inactive = resolved (has resolvedDate)
        where.resolvedDate = { not: null }
      }
    }

    const entries = await prisma.dentalChartEntry.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            lastName: true,
          }
        }
      },
      orderBy: [
        { toothNumber: 'asc' },
        { diagnosedDate: 'desc' }
      ]
    })

    // Group entries by tooth number for easier consumption
    const chartData: Record<number, any[]> = {}
    entries.forEach(entry => {
      if (!chartData[entry.toothNumber]) {
        chartData[entry.toothNumber] = []
      }
      chartData[entry.toothNumber].push(entry)
    })

    return NextResponse.json({
      entries,
      chartData,
      patientId
    })
  } catch (error) {
    console.error("Error fetching dental chart:", error)
    return NextResponse.json(
      { error: "Failed to fetch dental chart" },
      { status: 500 }
    )
  }
}

// POST - Create new dental chart entry
export async function POST(request: NextRequest) {
  const { error, hospitalId, session } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Check if user has permission
    if (!["ADMIN", "DOCTOR"].includes(session?.user?.role || "")) {
      return NextResponse.json(
        { error: "You don't have permission to update dental charts" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      patientId,
      toothNumber,
      condition,
      severity,
      mesial,
      distal,
      occlusal,
      buccal,
      lingual,
      notes,
      toothNotation,
    } = body

    // Validate required fields
    if (!patientId || !toothNumber || !condition) {
      return NextResponse.json(
        { error: "Patient ID, tooth number, and condition are required" },
        { status: 400 }
      )
    }

    // Validate tooth number (FDI notation: 11-18, 21-28, 31-38, 41-48)
    const validToothNumbers = [
      11, 12, 13, 14, 15, 16, 17, 18,
      21, 22, 23, 24, 25, 26, 27, 28,
      31, 32, 33, 34, 35, 36, 37, 38,
      41, 42, 43, 44, 45, 46, 47, 48
    ]

    if (!validToothNumbers.includes(toothNumber)) {
      return NextResponse.json(
        { error: "Invalid tooth number. Use FDI notation (11-18, 21-28, 31-38, 41-48)" },
        { status: 400 }
      )
    }

    // Check if patient exists and belongs to this hospital
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospitalId }
    })
    if (!patient) {
      return NextResponse.json(
        { error: "Patient not found" },
        { status: 404 }
      )
    }

    // If condition is MISSING or EXTRACTION, mark previous entries as resolved
    if (["MISSING", "EXTRACTION"].includes(condition)) {
      await prisma.dentalChartEntry.updateMany({
        where: {
          patientId,
          hospitalId,
          toothNumber,
          resolvedDate: null
        },
        data: {
          resolvedDate: new Date()
        }
      })
    }

    // Create new entry
    const entry = await prisma.dentalChartEntry.create({
      data: {
        hospitalId,
        patientId,
        toothNumber,
        toothNotation: toothNotation || String(toothNumber),
        condition,
        severity: severity || 'MILD',
        mesial: mesial || false,
        distal: distal || false,
        occlusal: occlusal || false,
        buccal: buccal || false,
        lingual: lingual || false,
        notes: notes || null,
        diagnosedDate: new Date(),
      },
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            lastName: true,
          }
        }
      }
    })

    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    console.error("Error creating dental chart entry:", error)
    return NextResponse.json(
      { error: "Failed to create dental chart entry" },
      { status: 500 }
    )
  }
}
