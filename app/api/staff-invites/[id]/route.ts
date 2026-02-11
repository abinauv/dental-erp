import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { StaffInviteStatus } from "@prisma/client"
import { sendInviteEmail } from "@/lib/email-helpers"

// Cancel/revoke an invite
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params

    const invite = await prisma.staffInvite.findUnique({
      where: { id },
    })

    if (!invite || invite.hospitalId !== hospitalId) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 })
    }

    if (invite.status !== StaffInviteStatus.PENDING) {
      return NextResponse.json(
        { error: "Can only cancel pending invites" },
        { status: 400 }
      )
    }

    await prisma.staffInvite.update({
      where: { id },
      data: { status: StaffInviteStatus.CANCELLED },
    })

    return NextResponse.json({
      success: true,
      message: "Invite cancelled successfully",
    })
  } catch (error) {
    console.error("Cancel invite error:", error)
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    )
  }
}

// Resend an invite
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params

    const invite = await prisma.staffInvite.findUnique({
      where: { id },
    })

    if (!invite || invite.hospitalId !== hospitalId) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 })
    }

    if (invite.status !== StaffInviteStatus.PENDING) {
      return NextResponse.json(
        { error: "Can only resend pending invites" },
        { status: 400 }
      )
    }

    // Extend expiry
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await prisma.staffInvite.update({
      where: { id },
      data: { expiresAt: newExpiresAt },
    })

    // Fetch hospital name and inviter for the email
    const [hospital, inviter] = await Promise.all([
      prisma.hospital.findUnique({ where: { id: hospitalId }, select: { name: true } }),
      invite.invitedBy
        ? prisma.user.findUnique({ where: { id: invite.invitedBy }, select: { name: true } })
        : null,
    ])

    // Resend invite email (non-blocking)
    const emailSent = await sendInviteEmail({
      to: invite.email,
      inviteeName: invite.name || "",
      hospitalName: hospital?.name || "Your Dental Clinic",
      role: invite.role,
      inviterName: inviter?.name || "Admin",
      token: invite.token,
    })

    return NextResponse.json({
      success: true,
      message: emailSent
        ? `Invite resent to ${invite.email}`
        : `Invite renewed for ${invite.email} (email delivery pending)`,
      expiresAt: newExpiresAt,
      emailSent,
    })
  } catch (error) {
    console.error("Resend invite error:", error)
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    )
  }
}
