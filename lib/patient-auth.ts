import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { createHmac, randomInt, timingSafeEqual } from 'crypto'
import { prisma } from './prisma'

const COOKIE_NAME = 'patient-portal-token'

// Patient session tokens and OTP hashes are keyed with NEXTAUTH_SECRET. The
// development fallback must never be used in production, where anyone who
// read this file could forge a patient session with it. Resolved on use, not
// at import, because `next build` runs in production mode without secrets.
function secret(): string {
  const value = process.env.NEXTAUTH_SECRET
  if (value) return value
  if (process.env.NODE_ENV === 'production') throw new Error('NEXTAUTH_SECRET is not set')
  return 'patient-portal-secret'
}

function jwtSecret(): Uint8Array {
  return new TextEncoder().encode(secret())
}

interface PatientTokenPayload {
  patientId: string
  hospitalId: string
  phone: string
}

/**
 * Generate a 6-digit OTP from a cryptographic source. Math.random() is
 * predictable once a few outputs are known, e.g. codes sent to your own phone.
 */
export function generateOTP(): string {
  return String(randomInt(100000, 1000000))
}

/**
 * What PatientOTP stores instead of the code. A 6-digit code has only a million
 * values, so a plain hash would fall to brute force from a database dump;
 * keying it with the server secret means a dump alone can't recover a live
 * code. Bound to the clinic and phone it was sent to.
 */
export function hashOTP(otp: string, hospitalId: string, phone: string): string {
  return createHmac('sha256', secret()).update(`${hospitalId}:${phone}:${otp}`).digest('hex')
}

/** Constant-time check of a submitted code against a stored hashOTP value. */
export function otpMatches(
  otp: string,
  storedHash: string,
  hospitalId: string,
  phone: string
): boolean {
  const expected = Buffer.from(hashOTP(otp, hospitalId, phone))
  const stored = Buffer.from(storedHash)
  return expected.length === stored.length && timingSafeEqual(expected, stored)
}

/**
 * Create a JWT for authenticated patient
 */
export async function createPatientToken(payload: PatientTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(jwtSecret())
}

/**
 * Verify and decode patient JWT
 */
async function verifyPatientToken(token: string): Promise<PatientTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret())
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
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
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
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  })
  return response
}

/**
 * Clear patient auth cookie
 */
export function clearPatientCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
  return response
}

export { COOKIE_NAME }
