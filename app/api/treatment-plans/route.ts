import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// Generate unique plan number for a hospital
async function generatePlanNumber(hospitalId: string): Promise<string> {
  const today = new Date()
  const prefix = `PLN${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`

  const lastPlan = await prisma.treatmentPlan.findFirst({
    where: {
      hospitalId,
      planNumber: {
        startsWith: prefix
      }
    },
    orderBy: {
      planNumber: 'desc'
    }
  })

  if (lastPlan) {
    const lastNumber = parseInt(lastPlan.planNumber.slice(-4))
    return `${prefix}${String(lastNumber + 1).padStart(4, '0')}`
  }

  return `${prefix}0001`
}

// GET - List treatment plans with filters
export async function GET(request: NextRequest) {
  const { error, hospitalId, session } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || ""
    const patientId = searchParams.get("patientId") || ""
    const consentGiven = searchParams.get("consentGiven")

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = { hospitalId }

    if (search) {
      where.OR = [
        { planNumber: { contains: search } },
        { title: { contains: search } },
        { patient: { firstName: { contains: search } } },
        { patient: { lastName: { contains: search } } },
        { patient: { patientId: { contains: search } } },
      ]
    }

    if (status) {
      where.status = status
    }

    if (patientId) {
      where.patientId = patientId
    }

    if (consentGiven !== null && consentGiven !== "") {
      where.consentGiven = consentGiven === "true"
    }

    const [treatmentPlans, total] = await Promise.all([
      prisma.treatmentPlan.findMany({
        where,
        include: {
          patient: {
            select: {
              id: true,
              patientId: true,
              firstName: true,
              lastName: true,
              phone: true,
            }
          },
          items: {
            include: {
              procedure: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  category: true,
                }
              }
            },
            orderBy: {
              priority: 'asc'
            }
          },
          _count: {
            select: {
              items: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit,
      }),
      prisma.treatmentPlan.count({ where })
    ])

    return NextResponse.json({
      treatmentPlans,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("Error fetching treatment plans:", error)
    return NextResponse.json(
      { error: "Failed to fetch treatment plans" },
      { status: 500 }
    )
  }
}

// POST - Create new treatment plan
export async function POST(request: NextRequest) {
  const { error, hospitalId, session } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Check if user has permission
    if (!["ADMIN", "DOCTOR"].includes(session?.user?.role || "")) {
      return NextResponse.json(
        { error: "You don't have permission to create treatment plans" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      patientId,
      title,
      notes,
      startDate,
      expectedEndDate,
      items = [],
    } = body

    // Validate required fields
    if (!patientId || !title) {
      return NextResponse.json(
        { error: "Patient and title are required" },
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

    // Validate procedures exist and belong to this hospital
    if (items.length > 0) {
      const procedureIds = items.map((item: any) => item.procedureId)
      const procedures = await prisma.procedure.findMany({
        where: {
          id: { in: procedureIds },
          hospitalId
        }
      })

      if (procedures.length !== procedureIds.length) {
        return NextResponse.json(
          { error: "One or more procedures not found" },
          { status: 404 }
        )
      }
    }

    // Generate plan number unique to this hospital
    const planNumber = await generatePlanNumber(hospitalId)

    // Calculate estimated cost and duration
    let estimatedCost = 0
    let estimatedDuration = 0

    if (items.length > 0) {
      const procedures = await prisma.procedure.findMany({
        where: {
          id: { in: items.map((item: any) => item.procedureId) },
          hospitalId
        }
      })

      const procedureMap = new Map(procedures.map(p => [p.id, p]))

      items.forEach((item: any) => {
        const proc = procedureMap.get(item.procedureId)
        if (proc) {
          estimatedCost += item.estimatedCost || Number(proc.basePrice)
          estimatedDuration += proc.defaultDuration
        }
      })
    }

    // Create treatment plan with items
    const treatmentPlan = await prisma.treatmentPlan.create({
      data: {
        hospitalId,
        planNumber,
        patientId,
        title,
        notes,
        status: "DRAFT",
        estimatedCost,
        estimatedDuration,
        startDate: startDate ? new Date(startDate) : null,
        expectedEndDate: expectedEndDate ? new Date(expectedEndDate) : null,
        consentGiven: false,
        items: {
          create: items.map((item: any, index: number) => ({
            procedureId: item.procedureId,
            toothNumbers: item.toothNumbers || null,
            priority: item.priority || index + 1,
            estimatedCost: item.estimatedCost || 0,
            notes: item.notes || null,
            status: "PENDING",
          }))
        }
      },
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            lastName: true,
          }
        },
        items: {
          include: {
            procedure: {
              select: {
                id: true,
                code: true,
                name: true,
                category: true,
                basePrice: true,
              }
            }
          },
          orderBy: {
            priority: 'asc'
          }
        }
      }
    })

    return NextResponse.json(treatmentPlan, { status: 201 })
  } catch (error) {
    console.error("Error creating treatment plan:", error)
    return NextResponse.json(
      { error: "Failed to create treatment plan" },
      { status: 500 }
    )
  }
}
