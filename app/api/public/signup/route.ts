import { NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { generateUniqueSlug, generateToken, PLAN_LIMITS } from "@/lib/api-helpers"
import { Plan, Role } from "@prisma/client"

const signupSchema = z.object({
  hospitalName: z.string().min(2, "Hospital name must be at least 2 characters"),
  adminName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = signupSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten() },
        { status: 400 }
      )
    }

    const { hospitalName, adminName, email, phone, password } = validated.data

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      )
    }

    // Generate unique slug for the hospital
    const slug = await generateUniqueSlug(hospitalName)

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Generate email verification token
    const verificationToken = generateToken(32)
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Create hospital and admin user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the hospital with FREE plan limits
      const hospital = await tx.hospital.create({
        data: {
          name: hospitalName,
          slug,
          email,
          phone,
          plan: Plan.FREE,
          isActive: true,
          onboardingCompleted: false,
          patientLimit: PLAN_LIMITS.FREE.patientLimit,
          staffLimit: PLAN_LIMITS.FREE.staffLimit,
          storageLimitMb: PLAN_LIMITS.FREE.storageLimitMb,
          emailVerificationToken: verificationToken,
          emailVerificationExpiry: verificationExpiry,
        },
      })

      // Create the admin user
      const user = await tx.user.create({
        data: {
          email,
          name: adminName,
          password: hashedPassword,
          phone,
          role: Role.ADMIN,
          isActive: true,
          isHospitalAdmin: true,
          hospitalId: hospital.id,
          staff: {
            create: {
              employeeId: "EMP001",
              firstName: adminName.split(" ")[0],
              lastName: adminName.split(" ").slice(1).join(" ") || "",
              email,
              phone,
              hospitalId: hospital.id,
            },
          },
        },
      })

      return { hospital, user }
    })

    // TODO: Send verification email
    // For now, we'll just return success with the token for testing
    // In production, send email with link: /verify-email?token={verificationToken}

    return NextResponse.json({
      success: true,
      message: "Account created successfully. Please check your email to verify your account.",
      hospitalId: result.hospital.id,
      // Remove this in production - only for development testing
      ...(process.env.NODE_ENV === "development" && { verificationToken }),
    })
  } catch (error) {
    console.error("Signup error:", error)
    return NextResponse.json(
      { error: "An error occurred during signup. Please try again." },
      { status: 500 }
    )
  }
}
