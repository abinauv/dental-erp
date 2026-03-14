import { NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { StaffInviteStatus, Role } from "@prisma/client"

const acceptInviteSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
})

// Accept an invite and create user account
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = acceptInviteSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten() },
        { status: 400 }
      )
    }

    const { token, password, phone } = validated.data

    // Find the invite
    const invite = await prisma.staffInvite.findUnique({
      where: { token },
      include: {
        hospital: {
          select: { id: true, name: true, isActive: true },
        },
      },
    })

    if (!invite) {
      return NextResponse.json(
        { error: "Invalid invite token" },
        { status: 400 }
      )
    }

    if (invite.status !== StaffInviteStatus.PENDING) {
      return NextResponse.json(
        { error: "This invite has already been used or cancelled" },
        { status: 400 }
      )
    }

    if (new Date() > invite.expiresAt) {
      await prisma.staffInvite.update({
        where: { id: invite.id },
        data: { status: StaffInviteStatus.EXPIRED },
      })
      return NextResponse.json(
        { error: "This invite has expired. Please ask for a new invite." },
        { status: 400 }
      )
    }

    if (!invite.hospital.isActive) {
      return NextResponse.json(
        { error: "This hospital account is no longer active" },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: invite.email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Generate employee ID
    const staffCount = await prisma.staff.count({
      where: { hospitalId: invite.hospitalId },
    })
    const employeeId = `EMP${String(staffCount + 1).padStart(3, "0")}`

    // Create user and staff in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the user
      const user = await tx.user.create({
        data: {
          email: invite.email,
          name: invite.name ?? invite.email.split("@")[0],
          password: hashedPassword,
          phone,
          role: invite.role as Role,
          isActive: true,
          isHospitalAdmin: false,
          hospitalId: invite.hospitalId,
          staff: {
            create: {
              employeeId,
              firstName: (invite.name ?? invite.email.split("@")[0]).split(" ")[0],
              lastName: (invite.name ?? "").split(" ").slice(1).join(" ") || "",
              email: invite.email,
              phone,
              hospitalId: invite.hospitalId,
            },
          },
        },
      })

      // Mark invite as accepted
      await tx.staffInvite.update({
        where: { id: invite.id },
        data: { status: StaffInviteStatus.ACCEPTED },
      })

      return user
    })

    return NextResponse.json({
      success: true,
      message: "Account created successfully. You can now log in.",
      hospitalName: invite.hospital.name,
    })
  } catch (error) {
    console.error("Accept invite error:", error)
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    )
  }
}

// GET endpoint to validate token and get invite details
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      )
    }

    const invite = await prisma.staffInvite.findUnique({
      where: { token },
      include: {
        hospital: {
          select: { name: true, isActive: true },
        },
      },
    })

    if (!invite) {
      return NextResponse.json(
        { valid: false, error: "Invalid invite token" },
        { status: 400 }
      )
    }

    if (invite.status !== StaffInviteStatus.PENDING) {
      return NextResponse.json(
        { valid: false, error: "This invite has already been used or cancelled" },
        { status: 400 }
      )
    }

    if (new Date() > invite.expiresAt) {
      return NextResponse.json(
        { valid: false, error: "This invite has expired" },
        { status: 400 }
      )
    }

    if (!invite.hospital.isActive) {
      return NextResponse.json(
        { valid: false, error: "This hospital account is no longer active" },
        { status: 400 }
      )
    }

    return NextResponse.json({
      valid: true,
      invite: {
        email: invite.email,
        name: invite.name,
        role: invite.role,
        hospitalName: invite.hospital.name,
        expiresAt: invite.expiresAt,
      },
    })
  } catch (error) {
    console.error("Validate invite error:", error)
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    )
  }
}
