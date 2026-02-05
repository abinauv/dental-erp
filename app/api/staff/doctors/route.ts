import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// GET - List doctors only (for appointments)
export async function GET(request: NextRequest) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) { return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  try {
    const doctors = await prisma.staff.findMany({
      where: {
        hospitalId,
        isActive: true,
        user: {
          role: "DOCTOR",
          isActive: true
        }
      },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        specialization: true,
        phone: true,
        email: true,
      },
      orderBy: { firstName: 'asc' }
    })

    return NextResponse.json({ doctors })
  } catch (error) {
    console.error("Error fetching doctors:", error)
    return NextResponse.json(
      { error: "Failed to fetch doctors" },
      { status: 500 }
    )
  }
}
