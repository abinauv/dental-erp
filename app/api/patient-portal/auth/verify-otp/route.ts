import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createPatientToken, setPatientCookie } from "@/lib/patient-auth"

/**
 * POST: Verify OTP and return JWT in httpOnly cookie.
 * Body: { phone, otp, hospitalSlug }
 */
export async function POST(req: NextRequest) {
  try {
    const { phone, otp, hospitalSlug } = (await req.json()) as {
      phone: string
      otp: string
      hospitalSlug: string
    }

    if (!phone || !otp || !hospitalSlug) {
      return NextResponse.json(
        { error: "Phone, OTP, and clinic identifier are required" },
        { status: 400 }
      )
    }

    // Find hospital
    const hospital = await prisma.hospital.findUnique({
      where: { slug: hospitalSlug },
      select: { id: true, name: true },
    })

    if (!hospital) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 })
    }

    // Find the most recent unverified OTP for this phone
    const otpRecord = await prisma.patientOTP.findFirst({
      where: {
        hospitalId: hospital.id,
        phone,
        verified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    })

    if (!otpRecord) {
      return NextResponse.json(
        { error: "OTP expired or not found. Please request a new one." },
        { status: 400 }
      )
    }

    // Check attempts (max 3)
    if (otpRecord.attempts >= 3) {
      return NextResponse.json(
        { error: "Too many failed attempts. Please request a new OTP." },
        { status: 429 }
      )
    }

    // Verify OTP
    if (otpRecord.otp !== otp) {
      await prisma.patientOTP.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      })
      return NextResponse.json(
        { error: "Invalid OTP. Please try again." },
        { status: 400 }
      )
    }

    // Mark OTP as verified
    await prisma.patientOTP.update({
      where: { id: otpRecord.id },
      data: { verified: true },
    })

    // Find the patient
    const patient = await prisma.patient.findFirst({
      where: { hospitalId: hospital.id, phone, isActive: true },
      select: {
        id: true,
        hospitalId: true,
        patientId: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
      },
    })

    if (!patient) {
      return NextResponse.json(
        { error: "Patient not found" },
        { status: 404 }
      )
    }

    // Generate JWT
    const token = await createPatientToken({
      patientId: patient.id,
      hospitalId: patient.hospitalId,
      phone: patient.phone,
    })

    const response = NextResponse.json({
      success: true,
      patient: {
        id: patient.id,
        patientId: patient.patientId,
        name: `${patient.firstName} ${patient.lastName}`,
        phone: patient.phone,
        email: patient.email,
      },
    })

    return setPatientCookie(response, token)
  } catch (err: unknown) {
    console.error("Verify OTP error:", err)
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    )
  }
}
