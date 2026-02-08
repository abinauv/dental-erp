"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Calendar,
  CreditCard,
  ClipboardList,
  Activity,
  ArrowRight,
  Clock,
  User,
  CalendarPlus,
} from "lucide-react"

interface DashboardData {
  upcomingAppointments: Array<{
    id: string
    appointmentNo: string
    scheduledDate: string
    scheduledTime: string
    appointmentType: string
    status: string
    doctor: { firstName: string; lastName: string; specialization: string | null }
  }>
  recentTreatments: Array<{
    id: string
    treatmentNo: string
    createdAt: string
    status: string
    procedure: { name: string; code: string | null }
    doctor: { firstName: string; lastName: string }
  }>
  outstandingInvoices: Array<{
    id: string
    invoiceNo: string
    totalAmount: number | string
    balanceAmount: number | string
    status: string
    dueDate: string | null
  }>
  stats: {
    totalVisits: number
    upcomingCount: number
    totalOutstanding: number
    outstandingCount: number
  }
}

export default function PatientDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/patient-portal/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

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

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/portal/book">
          <Button>
            <CalendarPlus className="h-4 w-4 mr-2" />
            Book Appointment
          </Button>
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-100">
                <Calendar className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.stats.upcomingCount}</p>
                <p className="text-xs text-muted-foreground">Upcoming</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-green-100">
                <Activity className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.stats.totalVisits}</p>
                <p className="text-xs text-muted-foreground">Total Visits</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-orange-100">
                <CreditCard className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.stats.outstandingCount}</p>
                <p className="text-xs text-muted-foreground">Pending Bills</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-red-100">
                <CreditCard className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(data.stats.totalOutstanding)}</p>
                <p className="text-xs text-muted-foreground">Balance Due</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Upcoming Appointments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Upcoming Appointments</CardTitle>
            <Link href="/portal/appointments" className="text-xs text-primary hover:underline flex items-center gap-1">
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {data.upcomingAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No upcoming appointments
              </p>
            ) : (
              <div className="space-y-3">
                {data.upcomingAppointments.map((apt) => (
                  <div key={apt.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {formatDate(apt.scheduledDate)} at {apt.scheduledTime}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          Dr. {apt.doctor.firstName} {apt.doctor.lastName}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">{apt.appointmentType.replace("_", " ")}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Outstanding Bills */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Outstanding Bills</CardTitle>
            <Link href="/portal/bills" className="text-xs text-primary hover:underline flex items-center gap-1">
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {data.outstandingInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                All bills are paid!
              </p>
            ) : (
              <div className="space-y-3">
                {data.outstandingInvoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="text-sm font-medium">{inv.invoiceNo}</p>
                      {inv.dueDate && (
                        <p className="text-xs text-muted-foreground">Due: {formatDate(inv.dueDate)}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(inv.balanceAmount)}</p>
                      <Badge
                        variant={inv.status === "PARTIALLY_PAID" ? "secondary" : "destructive"}
                        className="text-xs"
                      >
                        {inv.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Treatments */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Recent Treatments</CardTitle>
            <Link href="/portal/records" className="text-xs text-primary hover:underline flex items-center gap-1">
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {data.recentTreatments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No treatment records yet
              </p>
            ) : (
              <div className="space-y-3">
                {data.recentTreatments.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{t.procedure.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Dr. {t.doctor.firstName} {t.doctor.lastName} &middot; {formatDate(t.createdAt)}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">{t.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
