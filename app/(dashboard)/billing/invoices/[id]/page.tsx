"use client"

import { useState, useEffect, use } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Printer,
  CreditCard,
  FileText,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  IndianRupee,
  Banknote,
  Smartphone,
  Building2,
  Share2,
  Copy,
  Check,
  Loader2,
} from "lucide-react"
import {
  invoiceStatusConfig,
  paymentMethodConfig,
  paymentStatusConfig,
  formatCurrency,
  formatDate,
  formatDateTime,
  getDueDays,
  numberToWords,
  gstConfig,
} from "@/lib/billing-utils"
import { PaymentCheckout } from "@/components/billing/payment-checkout"

interface Invoice {
  id: string
  invoiceNo: string
  invoiceDate: string
  dueDate: string | null
  subtotal: string | number
  discountType: string
  discountValue: string | number
  discountAmount: string | number
  taxableAmount: string | number
  cgstRate: string | number
  cgstAmount: string | number
  sgstRate: string | number
  sgstAmount: string | number
  totalAmount: string | number
  paidAmount: string | number
  balanceAmount: string | number
  status: string
  notes: string | null
  termsAndConditions: string | null
  patient: {
    id: string
    patientId: string
    firstName: string
    lastName: string
    phone: string
    email: string | null
    address: string | null
    city: string | null
    state: string | null
    pincode: string | null
  }
  items: Array<{
    id: string
    description: string
    quantity: number
    unitPrice: string | number
    amount: string | number
    taxable: boolean
    treatment: {
      id: string
      treatmentNo: string
      toothNumbers: string | null
      procedure: {
        id: string
        name: string
        code: string
        category: string
      }
      doctor: {
        id: string
        firstName: string
        lastName: string
      }
    } | null
  }>
  payments: Array<{
    id: string
    paymentNo: string
    amount: string | number
    paymentMethod: string
    paymentDate: string
    status: string
    transactionId: string | null
    notes: string | null
    refundAmount: string | number | null
    refundDate: string | null
  }>
  insuranceClaim: {
    id: string
    claimNumber: string
    status: string
    approvedAmount: string | number | null
  } | null
}

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const showPaymentDialog = searchParams.get("action") === "payment"

  const [loading, setLoading] = useState(true)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [error, setError] = useState("")

  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(showPaymentDialog)
  const [paymentSubmitting, setPaymentSubmitting] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("")
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  )
  const [transactionId, setTransactionId] = useState("")
  const [paymentNotes, setPaymentNotes] = useState("")

  // Payment link state
  const [linkLoading, setLinkLoading] = useState(false)
  const [paymentLink, setPaymentLink] = useState("")
  const [linkCopied, setLinkCopied] = useState(false)

  const fetchInvoice = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/invoices/${id}`)
      if (!response.ok) throw new Error("Failed to fetch invoice")
      const data = await response.json()
      setInvoice(data)
      // Set default payment amount to balance
      setPaymentAmount(String(Number(data.balanceAmount)))
    } catch (error) {
      console.error("Error fetching invoice:", error)
      setError("Failed to load invoice")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoice()
  }, [id])

  const handleRecordPayment = async () => {
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      setError("Please enter a valid payment amount")
      return
    }
    if (!paymentMethod) {
      setError("Please select a payment method")
      return
    }

    try {
      setPaymentSubmitting(true)
      setError("")

      const response = await fetch(`/api/invoices/${id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(paymentAmount),
          paymentMethod,
          paymentDate,
          transactionId: transactionId || undefined,
          notes: paymentNotes || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to record payment")
      }

      setPaymentDialogOpen(false)
      fetchInvoice()

      // Reset form
      setPaymentAmount("")
      setPaymentMethod("")
      setTransactionId("")
      setPaymentNotes("")
    } catch (error: any) {
      setError(error.message)
    } finally {
      setPaymentSubmitting(false)
    }
  }

  const handleSharePaymentLink = async () => {
    try {
      setLinkLoading(true)
      const res = await fetch("/api/payments/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: id }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to generate link")
      }
      const data = await res.json()
      setPaymentLink(data.link.url)
      await navigator.clipboard.writeText(data.link.url)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLinkLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const config = invoiceStatusConfig[status as keyof typeof invoiceStatusConfig] || {
      label: status,
      color: "text-gray-700",
      bgColor: "bg-gray-100",
    }
    return (
      <Badge className={`${config.bgColor} ${config.color} border-0`}>
        {config.label}
      </Badge>
    )
  }

  const getPaymentStatusBadge = (status: string) => {
    const config = paymentStatusConfig[status as keyof typeof paymentStatusConfig] || {
      label: status,
      color: "text-gray-700",
      bgColor: "bg-gray-100",
    }
    return (
      <Badge className={`${config.bgColor} ${config.color} border-0`}>
        {config.label}
      </Badge>
    )
  }

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case "CASH":
        return <Banknote className="h-4 w-4" />
      case "CARD":
        return <CreditCard className="h-4 w-4" />
      case "UPI":
        return <Smartphone className="h-4 w-4" />
      case "BANK_TRANSFER":
        return <Building2 className="h-4 w-4" />
      default:
        return <CreditCard className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-96" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg text-muted-foreground">Invoice not found</p>
        <Link href="/billing/invoices">
          <Button variant="outline" className="mt-4">
            Back to Invoices
          </Button>
        </Link>
      </div>
    )
  }

  const dueDays = getDueDays(invoice.dueDate)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/billing/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">
                {invoice.invoiceNo}
              </h1>
              {getStatusBadge(invoice.status)}
            </div>
            <p className="text-muted-foreground">
              Created on {formatDate(invoice.invoiceDate)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          {["PENDING", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status) && (
            <>
              <PaymentCheckout
                invoiceId={invoice.id}
                amount={Number(invoice.balanceAmount)}
                invoiceNo={invoice.invoiceNo}
                patientName={`${invoice.patient.firstName} ${invoice.patient.lastName}`}
                onSuccess={fetchInvoice}
              />
              <Button onClick={() => setPaymentDialogOpen(true)}>
                <CreditCard className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Patient Info */}
          <Card>
            <CardHeader>
              <CardTitle>Bill To</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-lg">
                    {invoice.patient.firstName} {invoice.patient.lastName}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Patient ID: {invoice.patient.patientId}
                  </div>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {invoice.patient.phone}
                    </div>
                    {invoice.patient.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {invoice.patient.email}
                      </div>
                    )}
                    {invoice.patient.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {invoice.patient.address}
                        {invoice.patient.city && `, ${invoice.patient.city}`}
                        {invoice.patient.state && `, ${invoice.patient.state}`}
                        {invoice.patient.pincode && ` - ${invoice.patient.pincode}`}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Items */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Items</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50%]">Description</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium">{item.description}</div>
                        {item.treatment && (
                          <div className="text-sm text-muted-foreground">
                            {item.treatment.treatmentNo}
                            {item.treatment.doctor && (
                              <> • Dr. {item.treatment.doctor.firstName} {item.treatment.doctor.lastName}</>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Totals */}
              <div className="border-t p-4">
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatCurrency(invoice.subtotal)}</span>
                    </div>
                    {Number(invoice.discountAmount) > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount</span>
                        <span>-{formatCurrency(invoice.discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        CGST ({invoice.cgstRate}%)
                      </span>
                      <span>{formatCurrency(invoice.cgstAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        SGST ({invoice.sgstRate}%)
                      </span>
                      <span>{formatCurrency(invoice.sgstAmount)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span>{formatCurrency(invoice.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>Paid</span>
                      <span>{formatCurrency(invoice.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>Balance Due</span>
                      <span className={Number(invoice.balanceAmount) > 0 ? "text-red-600" : ""}>
                        {formatCurrency(invoice.balanceAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Amount in Words */}
          <Card>
            <CardContent className="py-4">
              <div className="text-sm">
                <span className="text-muted-foreground">Amount in words: </span>
                <span className="font-medium">
                  {numberToWords(Number(invoice.totalAmount))}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Payment History */}
          {invoice.payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          <div className="font-medium">{payment.paymentNo}</div>
                          {payment.transactionId && (
                            <div className="text-sm text-muted-foreground">
                              TXN: {payment.transactionId}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getPaymentMethodIcon(payment.paymentMethod)}
                            {paymentMethodConfig[payment.paymentMethod as keyof typeof paymentMethodConfig]?.label || payment.paymentMethod}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(payment.amount)}
                        </TableCell>
                        <TableCell>
                          {getPaymentStatusBadge(payment.status)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Notes & Terms */}
          {(invoice.notes || invoice.termsAndConditions) && (
            <Card>
              <CardContent className="py-4 space-y-4">
                {invoice.notes && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      Notes
                    </div>
                    <p className="text-sm">{invoice.notes}</p>
                  </div>
                )}
                {invoice.termsAndConditions && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      Terms & Conditions
                    </div>
                    <p className="text-sm whitespace-pre-line">
                      {invoice.termsAndConditions}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                {getStatusBadge(invoice.status)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Invoice Date</span>
                <span>{formatDate(invoice.invoiceDate)}</span>
              </div>
              {invoice.dueDate && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Due Date</span>
                  <div className="text-right">
                    <div>{formatDate(invoice.dueDate)}</div>
                    {dueDays.isOverdue && invoice.status !== "PAID" && (
                      <div className="text-xs text-red-600 flex items-center justify-end gap-1">
                        <Clock className="h-3 w-3" />
                        {dueDays.label}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Amount</span>
                <span className="font-semibold">
                  {formatCurrency(invoice.totalAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="text-green-600 font-semibold">
                  {formatCurrency(invoice.paidAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Balance Due</span>
                <span className={`font-semibold ${Number(invoice.balanceAmount) > 0 ? "text-red-600" : ""}`}>
                  {formatCurrency(invoice.balanceAmount)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Insurance Claim */}
          {invoice.insuranceClaim && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Insurance Claim
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Claim Number</span>
                  <span className="font-medium">{invoice.insuranceClaim.claimNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge>{invoice.insuranceClaim.status}</Badge>
                </div>
                {invoice.insuranceClaim.approvedAmount && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Approved</span>
                    <span className="font-medium text-green-600">
                      {formatCurrency(invoice.insuranceClaim.approvedAmount)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {["PENDING", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status) && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleSharePaymentLink}
                  disabled={linkLoading}
                >
                  {linkLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : linkCopied ? (
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                  ) : (
                    <Share2 className="h-4 w-4 mr-2" />
                  )}
                  {linkCopied ? "Link Copied!" : "Share Payment Link"}
                </Button>
              )}
              <Button variant="outline" className="w-full justify-start" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" />
                Print Invoice
              </Button>
              {invoice.patient.email && (
                <Button variant="outline" className="w-full justify-start">
                  <Mail className="h-4 w-4 mr-2" />
                  Send via Email
                </Button>
              )}
              <Link href={`/patients/${invoice.patient.id}`} className="block">
                <Button variant="outline" className="w-full justify-start">
                  <User className="h-4 w-4 mr-2" />
                  View Patient
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a payment for invoice {invoice.invoiceNo}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="pl-9"
                  max={Number(invoice.balanceAmount)}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Balance due: {formatCurrency(invoice.balanceAmount)}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="CARD">Card</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Transaction ID (Optional)</Label>
              <Input
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="Transaction reference number"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Any additional notes..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPaymentDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleRecordPayment} disabled={paymentSubmitting}>
              {paymentSubmitting ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
