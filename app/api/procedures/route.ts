import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// Generate unique procedure code
async function generateProcedureCode(category: string, hospitalId: string): Promise<string> {
  const prefixMap: Record<string, string> = {
    PREVENTIVE: "PRV",
    RESTORATIVE: "RST",
    ENDODONTIC: "END",
    PERIODONTIC: "PER",
    PROSTHODONTIC: "PRS",
    ORTHODONTIC: "ORT",
    ORAL_SURGERY: "SRG",
    COSMETIC: "COS",
    DIAGNOSTIC: "DGN",
    EMERGENCY: "EMR"
  }

  const prefix = prefixMap[category] || "GEN"

  const lastProcedure = await prisma.procedure.findFirst({
    where: {
      hospitalId,
      code: {
        startsWith: prefix
      }
    },
    orderBy: {
      code: 'desc'
    }
  })

  if (lastProcedure) {
    const lastNumber = parseInt(lastProcedure.code.slice(3))
    return `${prefix}${String(lastNumber + 1).padStart(3, '0')}`
  }

  return `${prefix}001`
}

// GET - List procedures with filters
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const search = searchParams.get("search") || ""
    const category = searchParams.get("category") || ""
    const isActive = searchParams.get("isActive")
    const all = searchParams.get("all") === "true"

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = { hospitalId }

    if (search) {
      where.OR = [
        { code: { contains: search } },
        { name: { contains: search } },
        { description: { contains: search } },
      ]
    }

    if (category) {
      where.category = category
    }

    if (isActive !== null && isActive !== "") {
      where.isActive = isActive === "true"
    }

    const [procedures, total] = await Promise.all([
      prisma.procedure.findMany({
        where,
        orderBy: [
          { category: 'asc' },
          { name: 'asc' }
        ],
        skip: all ? undefined : skip,
        take: all ? undefined : limit,
      }),
      prisma.procedure.count({ where })
    ])

    return NextResponse.json({
      procedures,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("Error fetching procedures:", error)
    return NextResponse.json(
      { error: "Failed to fetch procedures" },
      { status: 500 }
    )
  }
}

// POST - Create new procedure
export async function POST(request: NextRequest) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Check if user has permission (Admin or Doctor)
    if (!["ADMIN", "DOCTOR"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "You don't have permission to create procedures" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      name,
      category,
      description,
      defaultDuration = 30,
      basePrice,
      materials,
      preInstructions,
      postInstructions,
    } = body

    // Validate required fields
    if (!name || !category || !basePrice) {
      return NextResponse.json(
        { error: "Name, category, and base price are required" },
        { status: 400 }
      )
    }

    // Check if procedure name already exists
    const existingProcedure = await prisma.procedure.findFirst({
      where: {
        hospitalId,
        name: {
          equals: name,
        }
      }
    })

    if (existingProcedure) {
      return NextResponse.json(
        { error: "A procedure with this name already exists" },
        { status: 409 }
      )
    }

    // Generate procedure code
    const code = await generateProcedureCode(category, hospitalId)

    // Create procedure
    const procedure = await prisma.procedure.create({
      data: {
        hospitalId,
        code,
        name,
        category,
        description,
        defaultDuration,
        basePrice,
        materials,
        preInstructions,
        postInstructions,
        isActive: true,
      }
    })

    return NextResponse.json(procedure, { status: 201 })
  } catch (error) {
    console.error("Error creating procedure:", error)
    return NextResponse.json(
      { error: "Failed to create procedure" },
      { status: 500 }
    )
  }
}
