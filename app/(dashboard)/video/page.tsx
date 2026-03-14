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
  Video,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Eye,
  CalendarClock,
} from "lucide-react"
import { format } from "date-fns"

interface Consultation {
  id: string
  status: string
  scheduledAt: string
  startedAt: string | null
  endedAt: string | null
  duration: number | null
  patient: {
    id: string
    patientId: string
    firstName: string
    lastName: string
    phone: string
  }
  doctor: {
    id: string
    firstName: string
    lastName: string
    specialization: string | null
  }
  appointment: {
    id: string
    appointmentNo: string
  } | null
}

interface Summary {
  scheduled: number
  inProgress: number
  completed: number
  cancelled: number
}

export default function VideoConsultationsPage() {
  const { toast } = useToast()
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState("")
  const [summary, setSummary] = useState<Summary>({
    scheduled: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
  })

  useEffect(() => {
    fetchConsultations()
  }, [page, statusFilter])

  const fetchConsultations = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ page: String(page), limit: "20" })
      if (statusFilter) params.set("status", statusFilter)

      const res = await fetch(`/api/video/consultations?${params}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setConsultations(data.consultations)
      setTotalPages(data.totalPages)
      setSummary(data.summary)
    } catch {
      toast({ variant: "destructive", title: "Failed to load video consultations" })
    } finally {
      setLoading(false)
    }
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "SCHEDULED":
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Scheduled</Badge>
      case "IN_PROGRESS":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 animate-pulse">Live</Badge>
      case "COMPLETED":
        return <Badge className="bg-muted text-muted-foreground hover:bg-muted">Completed</Badge>
      case "CANCELLED":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Cancelled</Badge>
      case "NO_SHOW":
        return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">No Show</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Video Consultations</h1>
          <p className="text-muted-foreground">
            Manage tele-dentistry video consultations
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <CalendarClock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{summary.scheduled}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Play className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-green-600">{summary.inProgress}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
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
            <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-red-600">{summary.cancelled}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status Filters */}
      <div className="flex gap-2">
        {[
          { value: "", label: "All" },
          { value: "SCHEDULED", label: "Scheduled" },
          { value: "IN_PROGRESS", label: "Live" },
          { value: "COMPLETED", label: "Completed" },
          { value: "CANCELLED", label: "Cancelled" },
          { value: "NO_SHOW", label: "No Show" },
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

      {/* Consultations Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Appointment</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : consultations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No video consultations found
                  </TableCell>
                </TableRow>
              ) : (
                consultations.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {c.patient.firstName} {c.patient.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {c.patient.patientId}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          Dr. {c.doctor.firstName} {c.doctor.lastName}
                        </div>
                        {c.doctor.specialization && (
                          <div className="text-xs text-muted-foreground">
                            {c.doctor.specialization}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {c.appointment ? (
                        <Link
                          href={`/appointments/${c.appointment.id}`}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          {c.appointment.appointmentNo}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(c.scheduledAt), "dd MMM yyyy")}
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(c.scheduledAt), "hh:mm a")}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.duration != null ? `${c.duration} min` : "—"}
                    </TableCell>
                    <TableCell>{statusBadge(c.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {(c.status === "SCHEDULED" || c.status === "IN_PROGRESS") && (
                          <Link href={`/video/${c.id}`}>
                            <Button variant="ghost" size="sm" className="text-green-600">
                              <Video className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                        <Link href={`/video/${c.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
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
