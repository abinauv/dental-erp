import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"
import bcrypt from "bcryptjs"

// GET - Get single staff member details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) { return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  try {
    const { id } = await params

    const staff = await prisma.staff.findUnique({
      where: { id, hospitalId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true
          }
        },
        shifts: {
          orderBy: { dayOfWeek: 'asc' }
        },
        _count: {
          select: {
            appointments: true,
            treatments: true,
            prescriptions: true
          }
        }
      }
    })

    if (!staff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 })
    }

    return NextResponse.json(staff)
  } catch (error) {
    console.error("Error fetching staff:", error)
    return NextResponse.json(
      { error: "Failed to fetch staff details" },
      { status: 500 }
    )
  }
}

// PATCH - Update staff member
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) { return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  try {
    // Only admin can update staff
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const existingStaff = await prisma.staff.findUnique({
      where: { id, hospitalId },
      include: { user: true }
    })

    if (!existingStaff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 })
    }

    const {
      firstName,
      lastName,
      phone,
      alternatePhone,
      dateOfBirth,
      gender,
      address,
      city,
      state,
      pincode,
      aadharNumber,
      panNumber,
      qualification,
      specialization,
      licenseNumber,
      salary,
      bankAccountNo,
      bankIfsc,
      emergencyContact,
      emergencyPhone,
      isActive,
      role,
      newPassword
    } = body

    // Update in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update user if role or password changed
      if (role || newPassword || isActive !== undefined) {
        const userUpdateData: any = {}

        if (role) userUpdateData.role = role
        if (isActive !== undefined) userUpdateData.isActive = isActive
        if (newPassword) {
          userUpdateData.password = await bcrypt.hash(newPassword, 10)
        }
        if (firstName || lastName) {
          userUpdateData.name = `${firstName || existingStaff.firstName} ${lastName || existingStaff.lastName}`
        }

        await tx.user.update({
          where: { id: existingStaff.userId },
          data: userUpdateData
        })
      }

      // Update staff profile
      const updatedStaff = await tx.staff.update({
        where: { id },
        data: {
          ...(firstName && { firstName }),
          ...(lastName && { lastName }),
          ...(phone && { phone }),
          ...(alternatePhone !== undefined && { alternatePhone }),
          ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
          ...(gender && { gender }),
          ...(address !== undefined && { address }),
          ...(city !== undefined && { city }),
          ...(state !== undefined && { state }),
          ...(pincode !== undefined && { pincode }),
          ...(aadharNumber !== undefined && { aadharNumber }),
          ...(panNumber !== undefined && { panNumber }),
          ...(qualification !== undefined && { qualification }),
          ...(specialization !== undefined && { specialization }),
          ...(licenseNumber !== undefined && { licenseNumber }),
          ...(salary !== undefined && { salary: salary ? parseFloat(salary) : null }),
          ...(bankAccountNo !== undefined && { bankAccountNo }),
          ...(bankIfsc !== undefined && { bankIfsc }),
          ...(emergencyContact !== undefined && { emergencyContact }),
          ...(emergencyPhone !== undefined && { emergencyPhone }),
          ...(isActive !== undefined && { isActive })
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              isActive: true
            }
          }
        }
      })

      return updatedStaff
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error updating staff:", error)
    return NextResponse.json(
      { error: "Failed to update staff member" },
      { status: 500 }
    )
  }
}

// DELETE - Deactivate staff member (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId, session } = await requireAuthAndRole()
  if (error || !hospitalId) { return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  try {
    // Only admin can delete staff
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params

    const staff = await prisma.staff.findUnique({
      where: { id, hospitalId },
      include: { user: true }
    })

    if (!staff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 })
    }

    // Soft delete - deactivate both user and staff
    await prisma.$transaction([
      prisma.user.update({
        where: { id: staff.userId },
        data: { isActive: false }
      }),
      prisma.staff.update({
        where: { id },
        data: { isActive: false }
      })
    ])

    return NextResponse.json({ message: "Staff member deactivated successfully" })
  } catch (error) {
    console.error("Error deactivating staff:", error)
    return NextResponse.json(
      { error: "Failed to deactivate staff member" },
      { status: 500 }
    )
  }
}
