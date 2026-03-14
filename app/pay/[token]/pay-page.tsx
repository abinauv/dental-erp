"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  CreditCard,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  Building2,
  Phone,
  Mail,
  MapPin,
} from "lucide-react"

interface PayPageProps {
  token: string
  hospital: {
    name: string
    logo: string | null
    phone: string | null
    email: string | null
    address: string | null
    city: string | null
    state: string | null
  }
  invoice: {
    id: string
    invoiceNo: string
    totalAmount: number
    paidAmount: number
    balanceAmount: number
  }
  patient: {
    name: string
    phone: string
  }
  amount: number
  isExpired: boolean
  isUsed: boolean
  isPaid: boolean
}

type PayState = "idle" | "loading" | "checkout" | "verifying" | "success" | "error"

export function PayPage({
  token,
  hospital,
  invoice,
  patient,
  amount,
  isExpired,
  isUsed,
  isPaid,
}: PayPageProps) {
  const [state, setState] = useState<PayState>("idle")
  const [errorMsg, setErrorMsg] = useState("")

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(val)

  const canPay = !isExpired && !isUsed && !isPaid && amount > 0

  const initiatePayment = useCallback(async () => {
    try {
      setState("loading")
      setErrorMsg("")

      // Create order via public endpoint (uses token-based auth)
      const orderRes = await fetch("/api/payments/public-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, amount }),
      })

      if (!orderRes.ok) {
        const data = await orderRes.json()
        throw new Error(data.error || "Failed to create payment")
      }

      const orderData = await orderRes.json()
      const { checkout, order } = orderData

      setState("checkout")

      switch (checkout.provider) {
        case "razorpay":
          await handleRazorpay(checkout, order)
          break
        case "phonepe":
          handleRedirect(checkout.redirectUrl)
          break
        case "paytm":
          handlePaytmRedirect(checkout)
          break
        default:
          throw new Error("Unsupported provider")
      }
    } catch (err: unknown) {
      setState("error")
      setErrorMsg(err instanceof Error ? err.message : "Payment failed")
    }
  }, [token, amount])

  const handleRazorpay = async (
    checkout: Record<string, unknown>,
    order: Record<string, unknown>
  ) => {
    if (!(window as unknown as Record<string, unknown>).Razorpay) {
      await loadScript("https://checkout.razorpay.com/v1/checkout.js")
    }

    const RazorpayConstructor = (window as unknown as Record<string, unknown>).Razorpay as new (options: Record<string, unknown>) => {
      open: () => void
      on: (event: string, handler: () => void) => void
    }

    return new Promise<void>((resolve, reject) => {
      const options = {
        key: checkout.key,
        amount: checkout.amount,
        currency: "INR",
        name: hospital.name,
        description: `Payment for ${invoice.invoiceNo}`,
        order_id: checkout.orderId,
        prefill: {
          name: patient.name,
          contact: patient.phone,
        },
        theme: { color: "#0f172a" },
        handler: async (response: Record<string, string>) => {
          await verifyPayment({
            token,
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          })
          resolve()
        },
        modal: {
          ondismiss: () => {
            setState("idle")
            reject(new Error("Cancelled"))
          },
        },
      }

      const rzp = new RazorpayConstructor(options)
      rzp.on("payment.failed", () => {
        setState("error")
        setErrorMsg("Payment failed. Please try again.")
        reject(new Error("Failed"))
      })
      rzp.open()
    })
  }

  const handleRedirect = (url: string) => {
    if (url) window.location.href = url
    else {
      setState("error")
      setErrorMsg("Redirect URL not available")
    }
  }

  const handlePaytmRedirect = (checkout: Record<string, unknown>) => {
    const mid = checkout.mid as string
    const orderId = checkout.orderId as string
    const txnToken = checkout.txnToken as string
    const paytmAmount = checkout.amount as number
    const isProduction = !mid.includes("TEST")
    const baseUrl = isProduction
      ? "https://securegw.paytm.in"
      : "https://securegw-stage.paytm.in"

    const form = document.createElement("form")
    form.method = "POST"
    form.action = `${baseUrl}/theia/api/v1/showPaymentPage?mid=${mid}&orderId=${orderId}`

    const fields = { mid, orderId, txnToken, AMOUNT: String(paytmAmount) }
    for (const [key, value] of Object.entries(fields)) {
      const input = document.createElement("input")
      input.type = "hidden"
      input.name = key
      input.value = value
      form.appendChild(input)
    }
    document.body.appendChild(form)
    form.submit()
  }

  const verifyPayment = async (params: Record<string, string>) => {
    setState("verifying")
    try {
      const res = await fetch("/api/payments/public-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Verification failed")
      }
      setState("success")
    } catch (err: unknown) {
      setState("error")
      setErrorMsg(err instanceof Error ? err.message : "Verification failed")
    }
  }

  return (
    <div className="min-h-screen bg-muted/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-4">
          {hospital.logo ? (
            <img
              src={hospital.logo}
              alt={hospital.name}
              className="h-16 w-16 rounded-lg object-cover mx-auto mb-2"
            />
          ) : (
            <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          )}
          <CardTitle className="text-xl">{hospital.name}</CardTitle>
          <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
            {hospital.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" /> {hospital.phone}
              </span>
            )}
            {hospital.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" /> {hospital.email}
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Status messages */}
          {isExpired && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 text-yellow-700 text-sm">
              <Clock className="h-4 w-4" />
              This payment link has expired. Please contact the clinic for a new link.
            </div>
          )}
          {isUsed && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 text-blue-700 text-sm">
              <CheckCircle className="h-4 w-4" />
              This payment link has already been used.
            </div>
          )}
          {isPaid && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-700 text-sm">
              <CheckCircle className="h-4 w-4" />
              This invoice has been fully paid. Thank you!
            </div>
          )}

          {/* Invoice details */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Invoice</span>
              <span className="font-medium">{invoice.invoiceNo}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Patient</span>
              <span>{patient.name}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Amount</span>
              <span>{formatCurrency(invoice.totalAmount)}</span>
            </div>
            {invoice.paidAmount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Paid</span>
                <span>{formatCurrency(invoice.paidAmount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Amount Due</span>
              <span className="text-lg">{formatCurrency(amount)}</span>
            </div>
          </div>

          {/* Payment button / states */}
          {state === "idle" && canPay && (
            <Button className="w-full" size="lg" onClick={initiatePayment}>
              <CreditCard className="h-4 w-4 mr-2" />
              Pay {formatCurrency(amount)}
            </Button>
          )}

          {(state === "loading" || state === "checkout") && (
            <div className="flex flex-col items-center py-4 gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {state === "loading" ? "Preparing payment..." : "Waiting for payment..."}
              </p>
            </div>
          )}

          {state === "verifying" && (
            <div className="flex flex-col items-center py-4 gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Verifying payment...</p>
            </div>
          )}

          {state === "success" && (
            <div className="flex flex-col items-center py-6 gap-3">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <p className="font-medium text-green-700">Payment Successful!</p>
              <p className="text-sm text-muted-foreground text-center">
                {formatCurrency(amount)} has been received for invoice {invoice.invoiceNo}.
                Thank you!
              </p>
            </div>
          )}

          {state === "error" && (
            <div className="flex flex-col items-center py-4 gap-3">
              <AlertCircle className="h-10 w-10 text-red-500" />
              <p className="font-medium text-red-600">Payment Failed</p>
              <p className="text-sm text-muted-foreground text-center">{errorMsg}</p>
              {canPay && (
                <Button onClick={initiatePayment} variant="outline">
                  Try Again
                </Button>
              )}
            </div>
          )}

          <p className="text-xs text-center text-muted-foreground">
            Secure payment powered by your clinic&apos;s payment gateway
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) { resolve(); return }
    const script = document.createElement("script")
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load: ${src}`))
    document.head.appendChild(script)
  })
}
