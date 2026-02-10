"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  MapPin,
  Edit,
  LogIn,
  LogOut,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Stethoscope,
  FileText,
  History,
  Video,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  appointmentStatusConfig,
  appointmentTypeConfig,
  priorityConfig,
  formatTime,
  formatDate,
  getPatientName,
  getDoctorName,
} from "@/lib/appointment-utils"

interface Appointment {
  id: string
  appointmentNo: string
  scheduledDate: string
  scheduledTime: string
  duration: number
  chairNumber: number | null
  appointmentType: string
  status: string
  priority: string
  chiefComplaint: string | null
  notes: string | null
  checkedInAt: string | null
  checkedOutAt: string | null
  waitTime: number | null
  cancelledAt: string | null
  cancellationReason: string | null
  isVirtual: boolean
  videoConsultationId: string | null
  createdAt: string
  updatedAt: string
  patient: {
    id: string
    patientId: string
    firstName: string
    lastName: string
    phone: string
    email: string | null
    address: string | null
    city: string | null
    medicalHistory: {
      hasAllergies: boolean
      drugAllergies: string | null
      hasDiabetes: boolean
      hasHypertension: boolean
      hasHeartDisease: boolean
      currentMedications: string | null
    } | null
  }
  doctor: {
    id: string
    firstName: string
    lastName: string
    specialization: string | null
    phone: string | null
  }
  treatments: Array<{
    id: string
    treatmentNo: string
    status: string
    procedure: {
      name: string
      code: string
    }
  }>
  reminders: Array<{
    id: string
    reminderType: string
    status: string
    scheduledFor: string
    sentAt: string | null
  }>
}

export default function AppointmentDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Cancel dialog
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancellationReason, setCancellationReason] = useState("")

  const fetchAppointment = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/appointments/${id}`)
      if (!response.ok) throw new Error("Failed to fetch appointment")
      const data = await response.json()
      setAppointment(data)
    } catch (error) {
      console.error("Error fetching appointment:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAppointment()
  }, [id])

  const handleCheckIn = async () => {
    try {
      setActionLoading(true)
      const response = await fetch(`/api/appointments/${id}/check-in`, {
        method: "POST",
      })
      if (!response.ok) throw new Error("Failed to check in")
      fetchAppointment()
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCheckOut = async () => {
    try {
      setActionLoading(true)
      const response = await fetch(`/api/appointments/${id}/check-out`, {
        method: "POST",
      })
      if (!response.ok) throw new Error("Failed to check out")
      fetchAppointment()
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleStatusChange = async (status: string) => {
    try {
      setActionLoading(true)
      const body: any = { status }
      if (status === "CANCELLED" && cancellationReason) {
        body.cancellationReason = cancellationReason
      }

      const response = await fetch(`/api/appointments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error("Failed to update status")
      fetchAppointment()
      setShowCancelDialog(false)
      setCancellationReason("")
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const config = appointmentStatusConfig[status] || {
      label: status,
      color: "text-gray-700",
      bgColor: "bg-gray-100",
    }
    return (
      <Badge className={`${config.bgColor} ${config.color} border-0 text-base px-3 py-1`}>
        {config.label}
      </Badge>
    )
  }

  const getTypeBadge = (type: string) => {
    const config = appointmentTypeConfig[type] || {
      label: type,
      color: "text-gray-700",
      bgColor: "bg-gray-50",
    }
    return (
      <Badge variant="outline" className={`${config.bgColor} ${config.color} border-0`}>
        {config.label}
      </Badge>
    )
  }

  const getPriorityBadge = (priority: string) => {
    const config = priorityConfig[priority] || {
      label: priority,
      color: "text-gray-600",
      bgColor: "bg-gray-100",
    }
    return (
      <Badge variant="outline" className={`${config.bgColor} ${config.color} border-0`}>
        {config.label}
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!appointment) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Appointment not found</h2>
        <p className="text-muted-foreground mb-4">
          The appointment you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link href="/appointments">
          <Button>Back to Appointments</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/appointments">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">
                {appointment.appointmentNo}
              </h1>
              {getStatusBadge(appointment.status)}
              {appointment.isVirtual && (
                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                  <Video className="h-3 w-3 mr-1" />
                  Virtual
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              Created on {formatDate(appointment.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {appointment.isVirtual && appointment.videoConsultationId &&
            ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"].includes(appointment.status) && (
            <Link href={`/video/${appointment.videoConsultationId}`}>
              <Button className="bg-green-600 hover:bg-green-700">
                <Video className="h-4 w-4 mr-2" />
                Join Video Call
              </Button>
            </Link>
          )}
          {["SCHEDULED", "CONFIRMED"].includes(appointment.status) && (
            <Button onClick={handleCheckIn} disabled={actionLoading}>
              <LogIn className="h-4 w-4 mr-2" />
              Check In
            </Button>
          )}
          {["CHECKED_IN", "IN_PROGRESS"].includes(appointment.status) && (
            <Button onClick={handleCheckOut} disabled={actionLoading}>
              <LogOut className="h-4 w-4 mr-2" />
              Check Out
            </Button>
          )}
          {appointment.status === "SCHEDULED" && (
            <Button
              variant="outline"
              onClick={() => handleStatusChange("CONFIRMED")}
              disabled={actionLoading}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirm
            </Button>
          )}
          <Link href={`/appointments/${id}/edit`}>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
          {!["COMPLETED", "CANCELLED", "NO_SHOW"].includes(appointment.status) && (
            <Button
              variant="destructive"
              onClick={() => setShowCancelDialog(true)}
              disabled={actionLoading}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Appointment Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Appointment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium">{formatDate(appointment.scheduledDate)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Time</p>
                <p className="font-medium">{formatTime(appointment.scheduledTime)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="font-medium">{appointment.duration} minutes</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Chair</p>
                <p className="font-medium">
                  {appointment.chairNumber ? `Chair ${appointment.chairNumber}` : "Not assigned"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                {getTypeBadge(appointment.appointmentType)}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Priority</p>
                {getPriorityBadge(appointment.priority)}
              </div>
            </div>

            {(appointment.checkedInAt || appointment.checkedOutAt) && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  {appointment.checkedInAt && (
                    <div>
                      <p className="text-sm text-muted-foreground">Checked In</p>
                      <p className="font-medium">
                        {new Date(appointment.checkedInAt).toLocaleTimeString()}
                      </p>
                    </div>
                  )}
                  {appointment.checkedOutAt && (
                    <div>
                      <p className="text-sm text-muted-foreground">Checked Out</p>
                      <p className="font-medium">
                        {new Date(appointment.checkedOutAt).toLocaleTimeString()}
                      </p>
                    </div>
                  )}
                  {appointment.waitTime !== null && appointment.waitTime > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground">Wait Time</p>
                      <p className="font-medium">{appointment.waitTime} minutes</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {appointment.chiefComplaint && (
              <>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Chief Complaint</p>
                  <p className="font-medium">{appointment.chiefComplaint}</p>
                </div>
              </>
            )}

            {appointment.notes && (
              <div>
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="font-medium">{appointment.notes}</p>
              </div>
            )}

            {appointment.status === "CANCELLED" && (
              <>
                <Separator />
                <div className="rounded-lg bg-red-50 p-4">
                  <p className="text-sm font-medium text-red-700">
                    Cancelled on {new Date(appointment.cancelledAt!).toLocaleString()}
                  </p>
                  {appointment.cancellationReason && (
                    <p className="text-sm text-red-600 mt-1">
                      Reason: {appointment.cancellationReason}
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Patient Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Patient Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">
                  {getPatientName(appointment.patient)}
                </h3>
                <p className="text-muted-foreground">{appointment.patient.patientId}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{appointment.patient.phone}</span>
              </div>
              {appointment.patient.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{appointment.patient.email}</span>
                </div>
              )}
              {(appointment.patient.address || appointment.patient.city) && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {[appointment.patient.address, appointment.patient.city]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </div>
              )}
            </div>

            {appointment.patient.medicalHistory && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium mb-2">Medical Alerts</h4>
                  <div className="flex flex-wrap gap-2">
                    {appointment.patient.medicalHistory.hasAllergies && (
                      <Badge variant="destructive">Allergies</Badge>
                    )}
                    {appointment.patient.medicalHistory.hasDiabetes && (
                      <Badge variant="secondary">Diabetes</Badge>
                    )}
                    {appointment.patient.medicalHistory.hasHypertension && (
                      <Badge variant="secondary">Hypertension</Badge>
                    )}
                    {appointment.patient.medicalHistory.hasHeartDisease && (
                      <Badge variant="destructive">Heart Disease</Badge>
                    )}
                  </div>
                  {appointment.patient.medicalHistory.drugAllergies && (
                    <p className="text-sm text-red-600 mt-2">
                      Drug Allergies: {appointment.patient.medicalHistory.drugAllergies}
                    </p>
                  )}
                  {appointment.patient.medicalHistory.currentMedications && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Current Medications: {appointment.patient.medicalHistory.currentMedications}
                    </p>
                  )}
                </div>
              </>
            )}

            <div className="pt-2">
              <Link href={`/patients/${appointment.patient.id}`}>
                <Button variant="outline" className="w-full">
                  View Full Patient Profile
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Doctor Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              Doctor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Stethoscope className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{getDoctorName(appointment.doctor)}</h3>
                {appointment.doctor.specialization && (
                  <p className="text-sm text-muted-foreground">
                    {appointment.doctor.specialization}
                  </p>
                )}
                {appointment.doctor.phone && (
                  <p className="text-sm text-muted-foreground">
                    {appointment.doctor.phone}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Treatments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Treatments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {appointment.treatments.length === 0 ? (
              <p className="text-muted-foreground">No treatments recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {appointment.treatments.map((treatment) => (
                  <div
                    key={treatment.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{treatment.procedure.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {treatment.treatmentNo}
                      </p>
                    </div>
                    <Badge>{treatment.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Appointment</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this appointment? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="reason">Cancellation Reason</Label>
            <Input
              id="reason"
              placeholder="Enter reason for cancellation"
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Keep Appointment
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleStatusChange("CANCELLED")}
              disabled={actionLoading}
            >
              Cancel Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
