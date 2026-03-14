import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

const onboardingSchema = z.object({
  // Step 1: Clinic Details
  tagline: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pincode: z.string().min(5, "Valid pincode is required"),
  alternatePhone: z.string().optional(),
  website: z.string().optional(),

  // Step 2: Business Details
  gstNumber: z.string().optional(),
  registrationNo: z.string().optional(),

  // Step 3: Working Hours
  workingHours: z.string().optional(), // JSON string

  // Step 4: Payment Details
  upiId: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNo: z.string().optional(),
  bankIfsc: z.string().optional(),
  bankAccountName: z.string().optional(),
})

export async function POST(request: Request) {
  const { error, user, hospitalId } = await requireAuthAndRole(["ADMIN"])

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Only hospital admin can complete onboarding
  if (!user?.isHospitalAdmin) {
    return NextResponse.json({ error: "Only the hospital admin can complete onboarding" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const validated = onboardingSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten() },
        { status: 400 }
      )
    }

    const data = validated.data

    // Update hospital with onboarding data
    const hospital = await prisma.hospital.update({
      where: { id: hospitalId },
      data: {
        tagline: data.tagline,
        address: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        alternatePhone: data.alternatePhone,
        website: data.website,
        gstNumber: data.gstNumber,
        registrationNo: data.registrationNo,
        workingHours: data.workingHours,
        upiId: data.upiId,
        bankName: data.bankName,
        bankAccountNo: data.bankAccountNo,
        bankIfsc: data.bankIfsc,
        bankAccountName: data.bankAccountName,
        onboardingCompleted: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Onboarding completed successfully",
      hospital: {
        id: hospital.id,
        name: hospital.name,
        slug: hospital.slug,
      },
    })
  } catch (error) {
    console.error("Onboarding error:", error)
    return NextResponse.json(
      { error: "An error occurred during onboarding. Please try again." },
      { status: 500 }
    )
  }
}

// GET current onboarding status
export async function GET() {
  const { error, hospitalId } = await requireAuthAndRole()

  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        tagline: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        alternatePhone: true,
        website: true,
        gstNumber: true,
        registrationNo: true,
        workingHours: true,
        upiId: true,
        bankName: true,
        bankAccountNo: true,
        bankIfsc: true,
        bankAccountName: true,
        onboardingCompleted: true,
        plan: true,
      },
    })

    if (!hospital) {
      return NextResponse.json({ error: "Hospital not found" }, { status: 404 })
    }

    return NextResponse.json(hospital)
  } catch (error) {
    console.error("Get onboarding status error:", error)
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    )
  }
}
