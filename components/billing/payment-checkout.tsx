"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CreditCard, Loader2, CheckCircle, AlertCircle, ExternalLink } from "lucide-react"

interface PaymentCheckoutProps {
  invoiceId: string
  amount: number
  invoiceNo: string
  patientName: string
  onSuccess?: () => void
  onClose?: () => void
  open?: boolean
  trigger?: React.ReactNode
}

type CheckoutState = "idle" | "loading" | "checkout" | "verifying" | "success" | "error"

export function PaymentCheckout({
  invoiceId,
  amount,
  invoiceNo,
  patientName,
  onSuccess,
  onClose,
  open: controlledOpen,
  trigger,
}: PaymentCheckoutProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = (val: boolean) => {
    setInternalOpen(val)
    if (!val) onClose?.()
  }

  const [state, setState] = useState<CheckoutState>("idle")
  const [errorMsg, setErrorMsg] = useState("")

  const handleOpenChange = (val: boolean) => {
    if (state === "verifying" || state === "loading") return // Prevent close during processing
    setOpen(val)
    if (!val) {
      setState("idle")
      setErrorMsg("")
    }
  }

  const initiatePayment = useCallback(async () => {
    try {
      setState("loading")
      setErrorMsg("")

      // Step 1: Create order
      const orderRes = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, amount }),
      })

      if (!orderRes.ok) {
        const data = await orderRes.json()
        throw new Error(data.error || "Failed to create payment order")
      }

      const orderData = await orderRes.json()
      const { checkout, order, hospital, patient } = orderData

      setState("checkout")

      // Step 2: Open appropriate checkout based on provider
      switch (checkout.provider) {
        case "razorpay":
          await handleRazorpayCheckout(checkout, order, hospital, patient)
          break
        case "phonepe":
          handlePhonePeCheckout(checkout)
          break
        case "paytm":
          handlePaytmCheckout(checkout)
          break
        default:
          throw new Error(`Unsupported provider: ${checkout.provider}`)
      }
    } catch (err: unknown) {
      setState("error")
      setErrorMsg(err instanceof Error ? err.message : "Payment failed")
    }
  }, [invoiceId, amount])

  const handleRazorpayCheckout = async (
    checkout: Record<string, unknown>,
    order: Record<string, unknown>,
    hospital: Record<string, string>,
    patient: Record<string, string>
  ) => {
    // Load Razorpay script if not already loaded
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
        currency: checkout.currency || "INR",
        name: hospital.name,
        description: `Payment for ${invoiceNo}`,
        order_id: checkout.orderId,
        prefill: {
          name: patient.name,
          email: patient.email || "",
          contact: patient.phone || "",
        },
        theme: { color: "#0f172a" },
        handler: async (response: Record<string, string>) => {
          await verifyPayment({
            invoiceId,
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          })
          resolve()
        },
        modal: {
          ondismiss: () => {
            setState("idle")
            reject(new Error("Payment cancelled"))
          },
        },
      }

      const rzp = new RazorpayConstructor(options)
      rzp.on("payment.failed", () => {
        setState("error")
        setErrorMsg("Payment failed. Please try again.")
        reject(new Error("Payment failed"))
      })
      rzp.open()
    })
  }

  const handlePhonePeCheckout = (checkout: Record<string, unknown>) => {
    // PhonePe uses redirect-based flow
    const redirectUrl = checkout.redirectUrl as string
    if (redirectUrl) {
      window.location.href = redirectUrl
    } else {
      setState("error")
      setErrorMsg("Failed to get PhonePe redirect URL")
    }
  }

  const handlePaytmCheckout = (checkout: Record<string, unknown>) => {
    // Paytm redirect-based flow
    const mid = checkout.mid as string
    const orderId = checkout.orderId as string
    const txnToken = checkout.txnToken as string
    const paytmAmount = checkout.amount as number

    // Build Paytm payment page URL
    const isProduction = !mid.includes("TEST")
    const baseUrl = isProduction
      ? "https://securegw.paytm.in"
      : "https://securegw-stage.paytm.in"

    const form = document.createElement("form")
    form.method = "POST"
    form.action = `${baseUrl}/theia/api/v1/showPaymentPage?mid=${mid}&orderId=${orderId}`

    const fields = { mid: mid, orderId: orderId, txnToken: txnToken, AMOUNT: String(paytmAmount) }
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
      const res = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Verification failed")
      }

      setState("success")
      setTimeout(() => {
        setOpen(false)
        setState("idle")
        onSuccess?.()
      }, 2000)
    } catch (err: unknown) {
      setState("error")
      setErrorMsg(
        err instanceof Error ? err.message : "Payment verification failed"
      )
    }
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(val)

  return (
    <>
      {trigger ? (
        <div onClick={() => setOpen(true)}>{trigger}</div>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <CreditCard className="h-4 w-4 mr-2" />
          Pay Online
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {state === "success" ? "Payment Successful" : "Pay Online"}
            </DialogTitle>
            <DialogDescription>
              {state === "success"
                ? "Your payment has been processed successfully."
                : `Invoice ${invoiceNo} for ${patientName}`}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {state === "idle" && (
              <div className="space-y-4">
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-semibold text-lg">
                      {formatCurrency(amount)}
                    </span>
                  </div>
                </div>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={initiatePayment}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Pay {formatCurrency(amount)}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Secured payment via your clinic&apos;s payment gateway
                </p>
              </div>
            )}

            {(state === "loading" || state === "checkout") && (
              <div className="flex flex-col items-center py-8 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  {state === "loading"
                    ? "Preparing payment..."
                    : "Waiting for payment..."}
                </p>
              </div>
            )}

            {state === "verifying" && (
              <div className="flex flex-col items-center py-8 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Verifying payment...
                </p>
              </div>
            )}

            {state === "success" && (
              <div className="flex flex-col items-center py-8 gap-3">
                <CheckCircle className="h-12 w-12 text-green-500" />
                <p className="font-medium">Payment of {formatCurrency(amount)} received</p>
                <p className="text-sm text-muted-foreground">
                  Invoice {invoiceNo} updated
                </p>
              </div>
            )}

            {state === "error" && (
              <div className="flex flex-col items-center py-8 gap-3">
                <AlertCircle className="h-12 w-12 text-red-500" />
                <p className="font-medium text-red-600">Payment Failed</p>
                <p className="text-sm text-muted-foreground text-center">
                  {errorMsg}
                </p>
                <Button onClick={initiatePayment} variant="outline">
                  Try Again
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      resolve()
      return
    }
    const script = document.createElement("script")
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
    document.head.appendChild(script)
  })
}
