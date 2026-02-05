import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { StaffInviteStatus } from "@prisma/client"

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

    // TODO: Resend invite email

    return NextResponse.json({
      success: true,
      message: `Invite resent to ${invite.email}`,
      expiresAt: newExpiresAt,
    })
  } catch (error) {
    console.error("Resend invite error:", error)
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    )
  }
}
