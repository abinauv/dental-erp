"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  IndianRupee,
  CalendarClock,
  Ban,
  CreditCard,
} from "lucide-react"
import { format } from "date-fns"

interface Schedule {
  id: string
  installmentNo: number
  amount: number
  dueDate: string
  paidDate: string | null
  paidAmount: number | null
  paymentId: string | null
  status: string
  payment: {
    id: string
    paymentNo: string
    amount: number
    paymentMethod: string
    paymentDate: string
    status: string
  } | null
}

interface PlanDetail {
  id: string
  hospitalId: string
  invoiceId: string
  totalAmount: number
  downPayment: number
  installments: number
  frequency: string
  interestRate: number
  status: string
  startDate: string
  nextDueDate: string | null
  notes: string | null
  createdAt: string
  patient: {
    id: string
    patientId: string
    firstName: string
    lastName: string
    phone: string
    email: string | null
  }
  invoice: {
    id: string
    invoiceNo: string
    totalAmount: number
    paidAmount: number
    balanceAmount: number
    status: string
  }
  schedules: Schedule[]
  paidInstallments: number
  overdueInstallments: number
  totalPaid: number
  totalRemaining: number
}

export default function PaymentPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const [plan, setPlan] = useState<PlanDetail | null>(null)
  const [loading, setLoading] = useState(true)

  // Pay dialog
  const [payDialog, setPayDialog] = useState(false)
  const [payScheduleId, setPayScheduleId] = useState("")
  const [payAmount, setPayAmount] = useState(0)
  const [payMethod, setPayMethod] = useState("CASH")
  const [payTransactionId, setPayTransactionId] = useState("")
  const [paying, setPaying] = useState(false)

  // Cancel dialog
  const [cancelDialog, setCancelDialog] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    fetchPlan()
  }, [id])

  const fetchPlan = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/payment-plans/${id}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setPlan(data)
    } catch {
      toast({ variant: "destructive", title: "Failed to load payment plan" })
    } finally {
      setLoading(false)
    }
  }

  const handlePay = async () => {
    try {
      setPaying(true)
      const res = await fetch(`/api/payment-plans/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId: payScheduleId,
          amount: payAmount,
          paymentMethod: payMethod,
          transactionId: payTransactionId || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: data.message })
      setPayDialog(false)
      fetchPlan()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Payment Failed", description: err.message })
    } finally {
      setPaying(false)
    }
  }

  const handleCancel = async () => {
    try {
      setCancelling(true)
      const res = await fetch(`/api/payment-plans/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: "Payment plan cancelled" })
      setCancelDialog(false)
      fetchPlan()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setCancelling(false)
    }
  }

  const handleWaive = async (scheduleId: string) => {
    if (!confirm("Waive this installment? The patient won't need to pay it.")) return
    try {
      const res = await fetch(`/api/payment-plans/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "waive", scheduleId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: "Installment waived" })
      fetchPlan()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    }
  }

  const openPayDialog = (schedule: Schedule) => {
    setPayScheduleId(schedule.id)
    setPayAmount(schedule.amount)
    setPayMethod("CASH")
    setPayTransactionId("")
    setPayDialog(true)
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Active</Badge>
      case "COMPLETED":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Completed</Badge>
      case "DEFAULTED":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Defaulted</Badge>
      case "CANCELLED":
        return <Badge variant="secondary">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const installmentStatusIcon = (status: string) => {
    switch (status) {
      case "PAID":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "PENDING":
        return <Clock className="h-4 w-4 text-yellow-600" />
      case "OVERDUE":
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case "WAIVED":
        return <XCircle className="h-4 w-4 text-gray-400" />
      default:
        return null
    }
  }

  const installmentBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Paid</Badge>
      case "PENDING":
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Pending</Badge>
      case "OVERDUE":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Overdue</Badge>
      case "WAIVED":
        return <Badge variant="secondary">Waived</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const frequencyLabel = (freq: string) => {
    switch (freq) {
      case "WEEKLY":
        return "Weekly"
      case "BIWEEKLY":
        return "Bi-weekly"
      case "MONTHLY":
        return "Monthly"
      default:
        return freq
    }
  }

  const formatCurrency = (amount: number) =>
    `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Payment plan not found</p>
        <Link href="/billing/payment-plans">
          <Button variant="outline" className="mt-4">
            Back to Payment Plans
          </Button>
        </Link>
      </div>
    )
  }

  const progressPercent = (plan.paidInstallments / plan.installments) * 100

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/billing/payment-plans">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">Payment Plan</h1>
              {statusBadge(plan.status)}
            </div>
            <p className="text-muted-foreground">
              {plan.patient.firstName} {plan.patient.lastName} — Invoice{" "}
              <Link
                href={`/billing/invoices/${plan.invoice.id}`}
                className="text-blue-600 hover:underline"
              >
                {plan.invoice.invoiceNo}
              </Link>
            </p>
          </div>
        </div>
        {plan.status === "ACTIVE" && (
          <Button
            variant="outline"
            className="text-destructive"
            onClick={() => setCancelDialog(true)}
          >
            <Ban className="h-4 w-4 mr-2" />
            Cancel Plan
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(plan.totalAmount)}</div>
            {plan.interestRate > 0 && (
              <p className="text-xs text-muted-foreground">
                Includes {Number(plan.interestRate)}% interest
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(plan.totalPaid)}
            </div>
            <p className="text-xs text-muted-foreground">
              {plan.paidInstallments} of {plan.installments} installments
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining</CardTitle>
            <CalendarClock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(plan.totalRemaining)}
            </div>
            <p className="text-xs text-muted-foreground">
              {plan.installments - plan.paidInstallments - (plan.schedules.filter(s => s.status === "WAIVED").length)} remaining
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Due</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {plan.nextDueDate
                ? format(new Date(plan.nextDueDate), "dd MMM")
                : "—"}
            </div>
            {plan.overdueInstallments > 0 && (
              <p className="text-xs text-red-600">
                {plan.overdueInstallments} overdue
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Payment Progress</span>
            <span className="text-sm text-muted-foreground">
              {Math.round(progressPercent)}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-gray-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                plan.overdueInstallments > 0 ? "bg-red-500" : "bg-green-500"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>
              {plan.downPayment > 0 && `Down payment: ${formatCurrency(plan.downPayment)}`}
            </span>
            <span>{frequencyLabel(plan.frequency)} — Started {format(new Date(plan.startDate), "dd MMM yyyy")}</span>
          </div>
        </CardContent>
      </Card>

      {/* Plan Details */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Patient Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Patient Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">
                {plan.patient.firstName} {plan.patient.lastName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Patient ID</span>
              <span>{plan.patient.patientId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span>{plan.patient.phone}</span>
            </div>
            {plan.patient.email && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span>{plan.patient.email}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoice Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice No</span>
              <Link
                href={`/billing/invoices/${plan.invoice.id}`}
                className="text-blue-600 hover:underline font-medium"
              >
                {plan.invoice.invoiceNo}
              </Link>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice Total</span>
              <span className="font-medium">{formatCurrency(plan.invoice.totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Paid</span>
              <span className="text-green-600">{formatCurrency(plan.invoice.paidAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Balance</span>
              <span className="text-red-600">{formatCurrency(plan.invoice.balanceAmount)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Plan Terms */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Frequency</span>
              <span>{frequencyLabel(plan.frequency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Installments</span>
              <span>{plan.installments}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Interest Rate</span>
              <span>{Number(plan.interestRate)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Down Payment</span>
              <span>{formatCurrency(plan.downPayment)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{format(new Date(plan.createdAt), "dd MMM yyyy")}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      {plan.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{plan.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Installment Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Installment Schedule</CardTitle>
          <CardDescription>
            Track and manage each installment payment
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">#</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Paid Date</TableHead>
                <TableHead>Paid Amount</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead className="w-[140px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.schedules.map((schedule) => (
                <TableRow
                  key={schedule.id}
                  className={
                    schedule.status === "OVERDUE"
                      ? "bg-red-50"
                      : schedule.status === "PAID"
                        ? "bg-green-50/50"
                        : ""
                  }
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {installmentStatusIcon(schedule.status)}
                      <span className="font-medium">{schedule.installmentNo}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(new Date(schedule.dueDate), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(schedule.amount)}
                  </TableCell>
                  <TableCell>{installmentBadge(schedule.status)}</TableCell>
                  <TableCell>
                    {schedule.paidDate
                      ? format(new Date(schedule.paidDate), "dd MMM yyyy")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {schedule.paidAmount
                      ? formatCurrency(schedule.paidAmount)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {schedule.payment?.paymentMethod || "—"}
                  </TableCell>
                  <TableCell>
                    {(schedule.status === "PENDING" || schedule.status === "OVERDUE") &&
                      plan.status === "ACTIVE" && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            onClick={() => openPayDialog(schedule)}
                          >
                            <CreditCard className="h-3 w-3 mr-1" />
                            Pay
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleWaive(schedule.id)}
                          >
                            Waive
                          </Button>
                        </div>
                      )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pay Dialog */}
      <Dialog open={payDialog} onOpenChange={setPayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Installment Payment</DialogTitle>
            <DialogDescription>
              Record a payment for this installment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                min={1}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="CARD">Card</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                  <SelectItem value="ONLINE">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Transaction ID (Optional)</Label>
              <Input
                placeholder="Reference number..."
                value={payTransactionId}
                onChange={(e) => setPayTransactionId(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handlePay} disabled={paying || payAmount <= 0}>
              {paying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Record Payment — ${formatCurrency(payAmount)}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialog} onOpenChange={setCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Payment Plan</DialogTitle>
            <DialogDescription>
              This will cancel the payment plan and waive all remaining installments.
              Payments already made will not be refunded.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialog(false)}>
              Keep Plan
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Cancel Plan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
