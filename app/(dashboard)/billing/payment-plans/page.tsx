"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import {
  Plus,
  CalendarClock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  IndianRupee,
  Eye,
} from "lucide-react"
import { format } from "date-fns"

interface PaymentPlan {
  id: string
  invoiceId: string
  patientId: string
  totalAmount: number
  downPayment: number
  installments: number
  frequency: string
  interestRate: number
  status: string
  startDate: string
  nextDueDate: string | null
  createdAt: string
  patient: {
    id: string
    patientId: string
    firstName: string
    lastName: string
    phone: string
  }
  invoice: {
    id: string
    invoiceNo: string
    totalAmount: number
    balanceAmount: number
  }
  paidInstallments: number
  overdueInstallments: number
}

interface Summary {
  active: number
  completed: number
  defaulted: number
  totalOutstanding: number
}

export default function PaymentPlansPage() {
  const { toast } = useToast()
  const [plans, setPlans] = useState<PaymentPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState("")
  const [summary, setSummary] = useState<Summary>({
    active: 0,
    completed: 0,
    defaulted: 0,
    totalOutstanding: 0,
  })

  useEffect(() => {
    fetchPlans()
  }, [page, statusFilter])

  const fetchPlans = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ page: String(page), limit: "20" })
      if (statusFilter) params.set("status", statusFilter)

      const res = await fetch(`/api/payment-plans?${params}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setPlans(data.plans)
      setTotalPages(data.totalPages)
      setSummary(data.summary)
    } catch {
      toast({ variant: "destructive", title: "Failed to load payment plans" })
    } finally {
      setLoading(false)
    }
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

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payment Plans</h1>
          <p className="text-muted-foreground">
            Manage installment payment plans for invoices
          </p>
        </div>
        <Link href="/billing/payment-plans/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Payment Plan
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Plans</CardTitle>
            <CalendarClock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{summary.active}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{summary.completed}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Defaulted</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-red-600">{summary.defaulted}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <IndianRupee className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(summary.totalOutstanding)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status Filters */}
      <div className="flex gap-2">
        {[
          { value: "", label: "All" },
          { value: "ACTIVE", label: "Active" },
          { value: "COMPLETED", label: "Completed" },
          { value: "DEFAULTED", label: "Defaulted" },
          { value: "CANCELLED", label: "Cancelled" },
        ].map((f) => (
          <Button
            key={f.value}
            variant={statusFilter === f.value ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setStatusFilter(f.value)
              setPage(1)
            }}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Plans Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Installments</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Next Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : plans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No payment plans found
                  </TableCell>
                </TableRow>
              ) : (
                plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {plan.patient.firstName} {plan.patient.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {plan.patient.patientId}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/billing/invoices/${plan.invoice.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {plan.invoice.invoiceNo}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(plan.totalAmount)}
                    </TableCell>
                    <TableCell>{plan.installments}</TableCell>
                    <TableCell>{frequencyLabel(plan.frequency)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden max-w-[100px]">
                          <div
                            className={`h-full rounded-full ${
                              plan.overdueInstallments > 0 ? "bg-red-500" : "bg-green-500"
                            }`}
                            style={{
                              width: `${(plan.paidInstallments / plan.installments) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {plan.paidInstallments}/{plan.installments}
                        </span>
                      </div>
                      {plan.overdueInstallments > 0 && (
                        <span className="text-xs text-red-600">
                          {plan.overdueInstallments} overdue
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {plan.nextDueDate
                        ? format(new Date(plan.nextDueDate), "dd MMM yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell>{statusBadge(plan.status)}</TableCell>
                    <TableCell>
                      <Link href={`/billing/payment-plans/${plan.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
