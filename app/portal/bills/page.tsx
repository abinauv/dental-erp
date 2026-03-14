"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CreditCard,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Receipt,
  CheckCircle,
} from "lucide-react"

interface Invoice {
  id: string
  invoiceNo: string
  totalAmount: number | string
  paidAmount: number | string
  balanceAmount: number | string
  status: string
  dueDate: string | null
  createdAt: string
  items: Array<{
    description: string
    quantity: number
    unitPrice: number | string
    amount: number | string
  }>
  payments: Array<{
    id: string
    paymentNo: string
    amount: number | string
    paymentMethod: string
    paymentDate: string
    status: string
  }>
  paymentLinks: Array<{
    token: string
    amount: number | string
    expiresAt: string
  }>
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-muted text-foreground",
  PENDING: "bg-yellow-100 text-yellow-700",
  PARTIALLY_PAID: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
  OVERDUE: "bg-red-100 text-red-700",
  CANCELLED: "bg-muted text-foreground",
}

export default function PatientBills() {
  const [statusFilter, setStatusFilter] = useState("all")
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchBills = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: "10" })
      if (statusFilter !== "all") params.append("status", statusFilter)
      const res = await fetch(`/api/patient-portal/bills?${params}`)
      const data = await res.json()
      setInvoices(data.invoices || [])
      setPagination(data.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchBills(1)
  }, [fetchBills])

  const formatCurrency = (val: number | string) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(Number(val))

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bills & Payments</h1>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="PENDING">Pending</TabsTrigger>
          <TabsTrigger value="PARTIALLY_PAID">Partial</TabsTrigger>
          <TabsTrigger value="PAID">Paid</TabsTrigger>
        </TabsList>

        <TabsContent value={statusFilter} className="mt-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
            </div>
          ) : invoices.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Receipt className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No bills found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {invoices.map((inv) => (
                <Card key={inv.id}>
                  <CardContent className="py-4">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{inv.invoiceNo}</p>
                          <Badge className={statusColors[inv.status] || "bg-muted text-foreground"}>
                            {inv.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(inv.createdAt)}
                          {inv.dueDate && ` · Due: ${formatDate(inv.dueDate)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(inv.balanceAmount)}</p>
                          <p className="text-xs text-muted-foreground">
                            of {formatCurrency(inv.totalAmount)}
                          </p>
                        </div>
                        {expandedId === inv.id ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {expandedId === inv.id && (
                      <div className="mt-4 space-y-3">
                        <Separator />

                        {/* Items */}
                        <div>
                          <p className="text-sm font-medium mb-2">Items</p>
                          {inv.items.map((item, i) => (
                            <div key={i} className="flex justify-between text-sm py-1">
                              <span className="text-muted-foreground">
                                {item.description} x{item.quantity}
                              </span>
                              <span>{formatCurrency(item.amount)}</span>
                            </div>
                          ))}
                        </div>

                        {/* Payments */}
                        {inv.payments.length > 0 && (
                          <div>
                            <Separator className="mb-3" />
                            <p className="text-sm font-medium mb-2">Payment History</p>
                            {inv.payments.map((p) => (
                              <div key={p.id} className="flex justify-between items-center text-sm py-1">
                                <span className="text-muted-foreground">
                                  {p.paymentNo} — {p.paymentMethod.replace("_", " ")} —{" "}
                                  {formatDate(p.paymentDate)}
                                </span>
                                <div className="flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3 text-green-500" />
                                  <span className="text-green-700">{formatCurrency(p.amount)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Pay Online */}
                        {Number(inv.balanceAmount) > 0 && inv.paymentLinks.length > 0 && (
                          <>
                            <Separator />
                            <Button
                              className="w-full"
                              onClick={() =>
                                window.open(`/pay/${inv.paymentLinks[0].token}`, "_blank")
                              }
                            >
                              <CreditCard className="h-4 w-4 mr-2" />
                              Pay {formatCurrency(inv.balanceAmount)} Online
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => fetchBills(pagination.page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => fetchBills(pagination.page + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
