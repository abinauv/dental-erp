import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SignJWT, jwtVerify } from "jose"
import { prisma } from "./prisma"

const COOKIE_NAME = "patient-portal-token"
const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "patient-portal-secret"
)

interface PatientTokenPayload {
  patientId: string
  hospitalId: string
  phone: string
}

/**
 * Generate a 6-digit OTP
 */
export function generateOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

/**
 * Create a JWT for authenticated patient
 */
export async function createPatientToken(payload: PatientTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET)
}

/**
 * Verify and decode patient JWT
 */
async function verifyPatientToken(token: string): Promise<PatientTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as PatientTokenPayload
  } catch {
    return null
  }
}

/**
 * Get authenticated patient from request cookies.
 * Returns patient context or null.
 */
export async function getAuthenticatedPatient(req?: NextRequest) {
  let token: string | undefined

  if (req) {
    token = req.cookies.get(COOKIE_NAME)?.value
  } else {
    const cookieStore = await cookies()
    token = cookieStore.get(COOKIE_NAME)?.value
  }

  if (!token) return null

  const payload = await verifyPatientToken(token)
  if (!payload) return null

  // Verify patient still exists and is active
  const patient = await prisma.patient.findFirst({
    where: {
      id: payload.patientId,
      hospitalId: payload.hospitalId,
      isActive: true,
    },
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

  if (!patient) return null

  return patient
}

/**
 * Require authenticated patient — returns error response or patient context
 */
export async function requirePatientAuth(req?: NextRequest) {
  const patient = await getAuthenticatedPatient(req)

  if (!patient) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      patient: null,
    }
  }

  return { error: null, patient }
}

/**
 * Set patient auth cookie on response
 */
export function setPatientCookie(response: NextResponse, token: string) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: "/",
  })
  return response
}

/**
 * Clear patient auth cookie
 */
export function clearPatientCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  })
  return response
}

export { COOKIE_NAME }
