"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Loader2, CheckCircle2, XCircle, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [status, setStatus] = useState<"loading" | "success" | "error" | "pending">("loading")
  const [message, setMessage] = useState("")

  const token = searchParams.get("token")
  const email = searchParams.get("email")

  useEffect(() => {
    if (token) {
      verifyEmail(token)
    } else if (email) {
      setStatus("pending")
      setMessage(`We've sent a verification email to ${email}. Please check your inbox and click the verification link.`)
    } else {
      setStatus("error")
      setMessage("No verification token or email provided.")
    }
  }, [token, email])

  const verifyEmail = async (verificationToken: string) => {
    try {
      const response = await fetch("/api/public/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: verificationToken }),
      })

      const result = await response.json()

      if (response.ok) {
        setStatus("success")
        setMessage("Your email has been verified successfully!")
        toast({
          title: "Email verified!",
          description: "You can now log in to your account.",
        })
      } else {
        setStatus("error")
        setMessage(result.error || "Verification failed. Please try again.")
      }
    } catch {
      setStatus("error")
      setMessage("An error occurred during verification. Please try again.")
    }
  }

  const resendVerification = async () => {
    if (!email) return

    toast({
      title: "Verification email sent",
      description: "Please check your inbox for the verification link.",
    })
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center mb-4">
          {status === "loading" && (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          {status === "success" && (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
          )}
          {status === "error" && (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
          )}
          {status === "pending" && (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
          )}
        </div>
        <CardTitle className="text-2xl font-bold">
          {status === "loading" && "Verifying..."}
          {status === "success" && "Email Verified!"}
          {status === "error" && "Verification Failed"}
          {status === "pending" && "Check Your Email"}
        </CardTitle>
        <CardDescription className="text-base">
          {message}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "success" && (
          <Button asChild className="w-full">
            <Link href="/login">Continue to Login</Link>
          </Button>
        )}

        {status === "error" && (
          <div className="space-y-2">
            <Button asChild variant="outline" className="w-full">
              <Link href="/signup">Try signing up again</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/login">Back to Login</Link>
            </Button>
          </div>
        )}

        {status === "pending" && (
          <div className="space-y-4">
            <div className="text-center text-sm text-muted-foreground">
              <p>Didn&apos;t receive the email?</p>
              <p>Check your spam folder or click below to resend.</p>
            </div>
            <Button variant="outline" className="w-full" onClick={resendVerification}>
              Resend Verification Email
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/login">Back to Login</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <Card className="shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Loading...</CardTitle>
        </CardHeader>
      </Card>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
