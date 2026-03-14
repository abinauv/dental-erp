import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"

const verifySchema = z.object({
  token: z.string().min(1, "Token is required"),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = verifySchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 400 }
      )
    }

    const { token } = validated.data

    // Find hospital with this verification token
    const hospital = await prisma.hospital.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpiry: {
          gt: new Date(),
        },
      },
    })

    if (!hospital) {
      return NextResponse.json(
        { error: "Invalid or expired verification token" },
        { status: 400 }
      )
    }

    // Mark email as verified
    await prisma.hospital.update({
      where: { id: hospital.id },
      data: {
        emailVerificationToken: null,
        emailVerificationExpiry: null,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Email verified successfully. You can now log in.",
      hospitalSlug: hospital.slug,
    })
  } catch (error) {
    console.error("Email verification error:", error)
    return NextResponse.json(
      { error: "An error occurred during verification. Please try again." },
      { status: 500 }
    )
  }
}

// GET endpoint to check token validity
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

    const hospital = await prisma.hospital.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpiry: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    if (!hospital) {
      return NextResponse.json(
        { valid: false, error: "Invalid or expired token" },
        { status: 400 }
      )
    }

    return NextResponse.json({
      valid: true,
      hospitalName: hospital.name,
      email: hospital.email,
    })
  } catch (error) {
    console.error("Token validation error:", error)
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    )
  }
}
