"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import VideoRoom from "@/components/video/video-room"
import {
  ArrowLeft,
  Video,
  Clock,
  User,
  Calendar,
  Phone,
  Play,
  XCircle,
  Loader2,
} from "lucide-react"
import { format } from "date-fns"

interface Consultation {
  id: string
  roomUrl: string
  roomName: string
  status: string
  scheduledAt: string
  startedAt: string | null
  endedAt: string | null
  duration: number | null
  notes: string | null
  patient: {
    id: string
    patientId: string
    firstName: string
    lastName: string
    phone: string
    email: string | null
    dateOfBirth: string | null
    gender: string | null
    medicalHistory: {
      hasAllergies: boolean
      drugAllergies: string | null
      hasDiabetes: boolean
      hasHypertension: boolean
      hasHeartDisease: boolean
    } | null
  }
  doctor: {
    id: string
    firstName: string
    lastName: string
    specialization: string | null
    phone: string
  }
  appointment: {
    id: string
    appointmentNo: string
    scheduledDate: string
    scheduledTime: string
    appointmentType: string
    chiefComplaint: string | null
  } | null
}

export default function DoctorVideoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const [consultation, setConsultation] = useState<Consultation | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [inCall, setInCall] = useState(false)
  const [tokenData, setTokenData] = useState<{
    token: string | null
    provider: "daily" | "jitsi"
    participantName: string
    isDoctor: boolean
  } | null>(null)

  useEffect(() => {
    fetchConsultation()
  }, [id])

  const fetchConsultation = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/video/consultations/${id}`)
      if (!res.ok) throw new Error("Failed to fetch consultation")
      const data = await res.json()
      setConsultation(data)
    } catch {
      toast({ variant: "destructive", title: "Failed to load consultation" })
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (action: string) => {
    try {
      setActionLoading(true)
      const res = await fetch(`/api/video/consultations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Action failed")
      }
      await fetchConsultation()
      toast({ title: `Consultation ${action === "start" ? "started" : action === "cancel" ? "cancelled" : "updated"}` })
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message })
    } finally {
      setActionLoading(false)
    }
  }

  const joinCall = async () => {
    try {
      setActionLoading(true)
      // Get token
      const tokenRes = await fetch(`/api/video/token?consultationId=${id}`)
      if (!tokenRes.ok) throw new Error("Failed to get join token")
      const data = await tokenRes.json()
      setTokenData(data)

      // Start consultation if still scheduled
      if (consultation?.status === "SCHEDULED") {
        await handleAction("start")
      }

      setInCall(true)
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message })
    } finally {
      setActionLoading(false)
    }
  }

  const handleEndCall = async (notes: string) => {
    try {
      const res = await fetch(`/api/video/consultations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end", notes }),
      })
      if (!res.ok) throw new Error("Failed to end consultation")
      setInCall(false)
      await fetchConsultation()
      toast({ title: "Consultation ended and notes saved" })
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message })
    }
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "SCHEDULED":
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Scheduled</Badge>
      case "IN_PROGRESS":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 animate-pulse">In Progress</Badge>
      case "COMPLETED":
        return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Completed</Badge>
      case "CANCELLED":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Cancelled</Badge>
      case "NO_SHOW":
        return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">No Show</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    )
  }

  if (!consultation) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Consultation not found</p>
        <Link href="/appointments">
          <Button variant="outline" className="mt-4">Back to Appointments</Button>
        </Link>
      </div>
    )
  }

  // In-call view
  if (inCall && tokenData && consultation) {
    return (
      <div className="h-[calc(100vh-120px)]">
        <VideoRoom
          roomUrl={consultation.roomUrl}
          roomName={consultation.roomName}
          token={tokenData.token}
          provider={tokenData.provider}
          participantName={tokenData.participantName || "Doctor"}
          isDoctor={tokenData.isDoctor}
          consultationId={consultation.id}
          patient={consultation.patient}
          appointment={consultation.appointment ? {
            appointmentNo: consultation.appointment.appointmentNo,
            chiefComplaint: consultation.appointment.chiefComplaint || undefined,
          } : undefined}
          onEnd={handleEndCall}
        />
      </div>
    )
  }

  // Pre-call / post-call view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Video Consultation</h1>
            {statusBadge(consultation.status)}
          </div>
          <p className="text-sm text-muted-foreground">
            {format(new Date(consultation.scheduledAt), "dd MMM yyyy, hh:mm a")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(consultation.status === "SCHEDULED" || consultation.status === "IN_PROGRESS") && (
            <Button onClick={joinCall} disabled={actionLoading}>
              {actionLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Video className="h-4 w-4 mr-2" />
              )}
              {consultation.status === "IN_PROGRESS" ? "Rejoin Call" : "Start Call"}
            </Button>
          )}
          {consultation.status === "SCHEDULED" && (
            <>
              <Button
                variant="outline"
                onClick={() => handleAction("no_show")}
                disabled={actionLoading}
              >
                No Show
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleAction("cancel")}
                disabled={actionLoading}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Patient Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" />
              Patient Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="font-medium">
                {consultation.patient.firstName} {consultation.patient.lastName}
              </div>
              <div className="text-sm text-muted-foreground">{consultation.patient.patientId}</div>
            </div>
            {consultation.patient.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3 w-3 text-muted-foreground" />
                {consultation.patient.phone}
              </div>
            )}
            {consultation.patient.gender && (
              <div className="text-sm text-muted-foreground capitalize">
                {consultation.patient.gender.toLowerCase()}
              </div>
            )}
            {consultation.patient.medicalHistory && (
              <div className="pt-2 border-t space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase">Medical Alerts</p>
                {consultation.patient.medicalHistory.hasAllergies && (
                  <p className="text-xs text-red-600">Allergies: {consultation.patient.medicalHistory.drugAllergies || "Yes"}</p>
                )}
                {consultation.patient.medicalHistory.hasDiabetes && (
                  <p className="text-xs text-orange-600">Diabetes</p>
                )}
                {consultation.patient.medicalHistory.hasHypertension && (
                  <p className="text-xs text-orange-600">Hypertension</p>
                )}
                {consultation.patient.medicalHistory.hasHeartDisease && (
                  <p className="text-xs text-red-600">Heart Disease</p>
                )}
              </div>
            )}
            <Link href={`/patients/${consultation.patient.id}`}>
              <Button variant="link" className="px-0 h-auto text-sm">
                View Full Profile
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Consultation Details Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Video className="h-4 w-4" />
              Consultation Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-muted-foreground">Scheduled</p>
                <p className="font-medium">
                  {format(new Date(consultation.scheduledAt), "dd MMM yyyy, hh:mm a")}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Doctor</p>
                <p className="font-medium">
                  Dr. {consultation.doctor.firstName} {consultation.doctor.lastName}
                </p>
              </div>
              {consultation.startedAt && (
                <div>
                  <p className="text-muted-foreground">Started At</p>
                  <p className="font-medium">
                    {format(new Date(consultation.startedAt), "hh:mm a")}
                  </p>
                </div>
              )}
              {consultation.endedAt && (
                <div>
                  <p className="text-muted-foreground">Ended At</p>
                  <p className="font-medium">
                    {format(new Date(consultation.endedAt), "hh:mm a")}
                  </p>
                </div>
              )}
              {consultation.duration != null && (
                <div>
                  <p className="text-muted-foreground">Duration</p>
                  <p className="font-medium">{consultation.duration} min</p>
                </div>
              )}
            </div>
            {consultation.appointment && (
              <div className="pt-2 border-t">
                <p className="text-muted-foreground">Linked Appointment</p>
                <Link href={`/appointments/${consultation.appointment.id}`} className="text-blue-600 hover:underline">
                  {consultation.appointment.appointmentNo}
                </Link>
                {consultation.appointment.chiefComplaint && (
                  <p className="mt-1">Complaint: {consultation.appointment.chiefComplaint}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      {consultation.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consultation Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{consultation.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
