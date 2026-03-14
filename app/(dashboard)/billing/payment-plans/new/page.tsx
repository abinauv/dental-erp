"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Loader2, Calculator, Search } from "lucide-react"
import { format, addDays, addWeeks, addMonths } from "date-fns"
import Link from "next/link"

interface Invoice {
  id: string
  invoiceNo: string
  totalAmount: number
  paidAmount: number
  balanceAmount: number
  status: string
  patient: {
    id: string
    patientId: string
    firstName: string
    lastName: string
  }
}

interface SchedulePreview {
  installmentNo: number
  amount: number
  dueDate: Date
}

export default function NewPaymentPlanPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const preselectedInvoiceId = searchParams.get("invoiceId")

  const [invoiceSearch, setInvoiceSearch] = useState("")
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  const [installments, setInstallments] = useState(3)
  const [frequency, setFrequency] = useState("MONTHLY")
  const [downPayment, setDownPayment] = useState(0)
  const [interestRate, setInterestRate] = useState(0)
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [notes, setNotes] = useState("")

  const [schedule, setSchedule] = useState<SchedulePreview[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Fetch preselected invoice
  useEffect(() => {
    if (preselectedInvoiceId) {
      fetchInvoice(preselectedInvoiceId)
    }
  }, [preselectedInvoiceId])

  const fetchInvoice = async (id: string) => {
    try {
      const res = await fetch(`/api/invoices/${id}`)
      if (!res.ok) return
      const data = await res.json()
      setSelectedInvoice({
        id: data.id,
        invoiceNo: data.invoiceNo,
        totalAmount: Number(data.totalAmount),
        paidAmount: Number(data.paidAmount),
        balanceAmount: Number(data.balanceAmount),
        status: data.status,
        patient: data.patient,
      })
    } catch {
      // ignore
    }
  }

  const searchInvoices = useCallback(async () => {
    if (invoiceSearch.length < 2) return
    try {
      setSearchLoading(true)
      const res = await fetch(
        `/api/invoices?search=${encodeURIComponent(invoiceSearch)}&limit=10`
      )
      if (!res.ok) return
      const data = await res.json()
      setInvoices(
        (data.invoices || [])
          .filter((inv: any) => inv.status !== "PAID" && inv.status !== "CANCELLED")
          .map((inv: any) => ({
            id: inv.id,
            invoiceNo: inv.invoiceNo,
            totalAmount: Number(inv.totalAmount),
            paidAmount: Number(inv.paidAmount),
            balanceAmount: Number(inv.balanceAmount),
            status: inv.status,
            patient: inv.patient,
          }))
      )
    } catch {
      // ignore
    } finally {
      setSearchLoading(false)
    }
  }, [invoiceSearch])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (invoiceSearch.length >= 2) searchInvoices()
    }, 300)
    return () => clearTimeout(timer)
  }, [invoiceSearch, searchInvoices])

  // Generate schedule preview
  useEffect(() => {
    if (!selectedInvoice || installments < 2) {
      setSchedule([])
      return
    }

    const balance = selectedInvoice.balanceAmount
    const dp = Math.min(downPayment, balance)
    const principal = balance - dp
    const rate = interestRate / 100
    const totalWithInterest = principal * (1 + rate)
    const emiAmount = Math.ceil((totalWithInterest / installments) * 100) / 100

    const planStart = new Date(startDate)
    const preview: SchedulePreview[] = []

    for (let i = 0; i < installments; i++) {
      let dueDate: Date
      switch (frequency) {
        case "WEEKLY":
          dueDate = addWeeks(planStart, i)
          break
        case "BIWEEKLY":
          dueDate = addDays(planStart, i * 14)
          break
        case "MONTHLY":
        default:
          dueDate = addMonths(planStart, i)
          break
      }

      const amount =
        i === installments - 1
          ? Math.round((totalWithInterest - emiAmount * (installments - 1)) * 100) / 100
          : emiAmount

      preview.push({
        installmentNo: i + 1,
        amount,
        dueDate,
      })
    }

    setSchedule(preview)
  }, [selectedInvoice, installments, frequency, downPayment, interestRate, startDate])

  const totalPlanAmount = () => {
    if (!selectedInvoice) return 0
    const balance = selectedInvoice.balanceAmount
    const dp = Math.min(downPayment, balance)
    const principal = balance - dp
    const rate = interestRate / 100
    return principal * (1 + rate) + dp
  }

  const interestAmount = () => {
    if (!selectedInvoice) return 0
    const balance = selectedInvoice.balanceAmount
    const dp = Math.min(downPayment, balance)
    const principal = balance - dp
    return principal * (interestRate / 100)
  }

  const handleSubmit = async () => {
    if (!selectedInvoice) {
      toast({ variant: "destructive", title: "Please select an invoice" })
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch("/api/payment-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: selectedInvoice.id,
          installments,
          frequency,
          downPayment,
          interestRate,
          startDate,
          notes,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create plan")

      toast({ title: "Payment plan created successfully" })
      router.push(`/billing/payment-plans/${data.id}`)
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const formatCurrency = (amount: number) =>
    `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/billing/payment-plans">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Payment Plan</h1>
          <p className="text-muted-foreground">
            Set up an installment plan for an outstanding invoice
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Configuration */}
        <div className="space-y-6">
          {/* Invoice Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Invoice</CardTitle>
              <CardDescription>
                Choose an unpaid or partially paid invoice
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedInvoice ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by invoice number or patient name..."
                      value={invoiceSearch}
                      onChange={(e) => setInvoiceSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {searchLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Searching...
                    </div>
                  )}
                  {invoices.length > 0 && (
                    <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                      {invoices.map((inv) => (
                        <button
                          key={inv.id}
                          className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
                          onClick={() => {
                            setSelectedInvoice(inv)
                            setInvoices([])
                            setInvoiceSearch("")
                          }}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{inv.invoiceNo}</div>
                              <div className="text-sm text-muted-foreground">
                                {inv.patient.firstName} {inv.patient.lastName} ({inv.patient.patientId})
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-red-600">
                                {formatCurrency(inv.balanceAmount)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                of {formatCurrency(inv.totalAmount)}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-lg">{selectedInvoice.invoiceNo}</div>
                      <div className="text-sm text-muted-foreground">
                        {selectedInvoice.patient.firstName} {selectedInvoice.patient.lastName}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedInvoice(null)}
                    >
                      Change
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                    <div>
                      <div className="text-muted-foreground">Total</div>
                      <div className="font-medium">{formatCurrency(selectedInvoice.totalAmount)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Paid</div>
                      <div className="font-medium text-green-600">
                        {formatCurrency(selectedInvoice.paidAmount)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Balance</div>
                      <div className="font-medium text-red-600">
                        {formatCurrency(selectedInvoice.balanceAmount)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Plan Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Plan Configuration</CardTitle>
              <CardDescription>
                Configure installment frequency, count, and terms
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Number of Installments</Label>
                  <Input
                    type="number"
                    min={2}
                    max={60}
                    value={installments}
                    onChange={(e) => setInstallments(parseInt(e.target.value) || 2)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WEEKLY">Weekly</SelectItem>
                      <SelectItem value="BIWEEKLY">Bi-weekly</SelectItem>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Down Payment (₹)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={downPayment}
                    onChange={(e) => setDownPayment(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Interest Rate (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    step={0.5}
                    value={interestRate}
                    onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                  placeholder="Any additional terms or notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Preview */}
        <div className="space-y-6">
          {/* Summary */}
          {selectedInvoice && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Plan Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Invoice Balance</div>
                    <div className="font-medium text-lg">
                      {formatCurrency(selectedInvoice.balanceAmount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Down Payment</div>
                    <div className="font-medium text-lg">
                      {formatCurrency(Math.min(downPayment, selectedInvoice.balanceAmount))}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Interest Amount</div>
                    <div className="font-medium text-lg">
                      {formatCurrency(interestAmount())}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Total Plan Amount</div>
                    <div className="font-medium text-lg text-blue-600">
                      {formatCurrency(totalPlanAmount())}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">EMI Amount</div>
                    <div className="font-bold text-xl text-green-600">
                      {schedule.length > 0 ? formatCurrency(schedule[0].amount) : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Last Payment Date</div>
                    <div className="font-medium">
                      {schedule.length > 0
                        ? format(schedule[schedule.length - 1].dueDate, "dd MMM yyyy")
                        : "—"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Schedule Preview */}
          {schedule.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Installment Schedule</CardTitle>
                <CardDescription>
                  Preview of {installments} installments
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">#</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedule.map((item) => (
                        <TableRow key={item.installmentNo}>
                          <TableCell className="font-medium">
                            {item.installmentNo}
                          </TableCell>
                          <TableCell>
                            {format(item.dueDate, "dd MMM yyyy")}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(item.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submit */}
          <Button
            className="w-full"
            size="lg"
            disabled={!selectedInvoice || submitting || schedule.length === 0}
            onClick={handleSubmit}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Plan...
              </>
            ) : (
              "Create Payment Plan"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
