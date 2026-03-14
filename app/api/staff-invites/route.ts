import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole, checkStaffLimit, generateToken } from "@/lib/api-helpers"
import { Role, StaffInviteStatus } from "@prisma/client"
import { sendInviteEmail } from "@/lib/email-helpers"

const inviteSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  role: z.enum(["DOCTOR", "RECEPTIONIST", "LAB_TECH", "ACCOUNTANT"]),
})

// Create a new staff invite
export async function POST(request: Request) {
  const { error, user, hospitalId } = await requireAuthAndRole(["ADMIN"])

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const validated = inviteSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten() },
        { status: 400 }
      )
    }

    const { email, name, role } = validated.data

    // Check staff limit
    const staffLimit = await checkStaffLimit(hospitalId)
    if (!staffLimit.allowed) {
      return NextResponse.json(
        {
          error: "Staff limit reached",
          message: `Your plan allows up to ${staffLimit.max} staff members. Please upgrade to add more.`,
          current: staffLimit.current,
          max: staffLimit.max,
        },
        { status: 403 }
      )
    }

    // Check if email already exists in the hospital
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        hospitalId,
      },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists in your hospital" },
        { status: 409 }
      )
    }

    // Check for pending invite with same email
    const existingInvite = await prisma.staffInvite.findFirst({
      where: {
        email,
        hospitalId,
        status: StaffInviteStatus.PENDING,
      },
    })

    if (existingInvite) {
      return NextResponse.json(
        { error: "An invite has already been sent to this email" },
        { status: 409 }
      )
    }

    // Generate invite token (valid for 7 days)
    const token = generateToken(32)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    // Create the invite
    const invite = await prisma.staffInvite.create({
      data: {
        email,
        name,
        role: role as Role,
        token,
        expiresAt,
        hospitalId,
        invitedBy: user!.id,
      },
    })

    // Get hospital name for the email
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { name: true },
    })

    // Send invite email (non-blocking — logs error if SMTP not configured)
    const emailSent = await sendInviteEmail({
      to: email,
      inviteeName: name,
      hospitalName: hospital?.name || "Your Dental Clinic",
      role,
      inviterName: user!.name || "Admin",
      token,
    })

    return NextResponse.json({
      success: true,
      message: emailSent
        ? `Invitation sent to ${email}`
        : `Invite created for ${email} (email delivery pending — check SMTP settings)`,
      invite: {
        id: invite.id,
        email: invite.email,
        name: invite.name,
        role: invite.role,
        expiresAt: invite.expiresAt,
      },
      emailSent,
      // Development-only: show direct link for testing
      ...(process.env.NODE_ENV === "development" && {
        inviteLink: `/invite/accept?token=${token}`,
      }),
    })
  } catch (error) {
    console.error("Create invite error:", error)
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    )
  }
}

// List all invites for the hospital
export async function GET() {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const invites = await prisma.staffInvite.findMany({
      where: { hospitalId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        invitedBy: true,
        acceptedAt: true,
      },
    })

    return NextResponse.json({ invites })
  } catch (error) {
    console.error("List invites error:", error)
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    )
  }
}
