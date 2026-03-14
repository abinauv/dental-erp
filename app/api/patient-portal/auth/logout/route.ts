import { NextResponse } from "next/server"
import { clearPatientCookie } from "@/lib/patient-auth"

/**
 * POST: Clear patient portal session cookie.
 */
export async function POST() {
  const response = NextResponse.json({ success: true })
  return clearPatientCookie(response)
}
