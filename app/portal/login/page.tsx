"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building2, Phone, Loader2, ArrowLeft, ShieldCheck } from "lucide-react"

type Step = "phone" | "otp"

export default function PatientLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clinic = searchParams.get("clinic") || ""

  const [step, setStep] = useState<Step>("phone")
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [clinicSlug, setClinicSlug] = useState(clinic)
  const [clinicName, setClinicName] = useState("")

  const sendOTP = async () => {
    if (!phone || phone.length < 10) {
      setError("Please enter a valid 10-digit phone number")
      return
    }
    if (!clinicSlug) {
      setError("Please enter your clinic identifier")
      return
    }

    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/patient-portal/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, hospitalSlug: clinicSlug }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to send OTP")
        return
      }

      setStep("otp")
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const verifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      setError("Please enter the 6-digit OTP")
      return
    }

    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/patient-portal/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp, hospitalSlug: clinicSlug }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Verification failed")
        return
      }

      router.push("/portal")
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl">Patient Portal</CardTitle>
          <CardDescription>
            {step === "phone"
              ? "Enter your phone number to receive a login code"
              : "Enter the 6-digit code sent to your phone"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}

          {step === "phone" ? (
            <>
              {!clinic && (
                <div className="space-y-2">
                  <Label htmlFor="clinic">Clinic ID</Label>
                  <Input
                    id="clinic"
                    placeholder="e.g. smile-dental"
                    value={clinicSlug}
                    onChange={(e) => setClinicSlug(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Your clinic will provide this identifier
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="Enter your 10-digit number"
                    className="pl-10"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    maxLength={10}
                  />
                </div>
              </div>
              <Button className="w-full" onClick={sendOTP} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Send OTP
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="otp">Verification Code</Label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    placeholder="Enter 6-digit OTP"
                    className="pl-10 text-center text-lg tracking-widest"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Sent to {phone}
                </p>
              </div>
              <Button className="w-full" onClick={verifyOTP} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Verify & Login
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => { setStep("phone"); setOtp(""); setError("") }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Change Phone Number
              </Button>
            </>
          )}

          <p className="text-xs text-center text-muted-foreground pt-2">
            Secure login powered by your clinic&apos;s patient portal
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
