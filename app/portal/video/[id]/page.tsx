"use client"

import { useState, useEffect, use, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Video,
  Clock,
  User,
  Phone,
  Calendar,
  ArrowLeft,
  Maximize,
  Minimize,
} from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"

interface ConsultationData {
  consultation: {
    id: string
    roomUrl: string
    roomName: string
    status: string
    scheduledAt: string
    startedAt: string | null
    endedAt: string | null
    duration: number | null
    doctor: {
      firstName: string
      lastName: string
      specialization: string | null
    }
    appointment: {
      appointmentNo: string
      scheduledDate: string
      scheduledTime: string
      chiefComplaint: string | null
    } | null
  }
  token: string | null
  roomUrl: string
  provider: "daily" | "jitsi"
  participantName: string
}

export default function PatientVideoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [data, setData] = useState<ConsultationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [inCall, setInCall] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    fetchConsultation()
  }, [id])

  // Timer
  useEffect(() => {
    if (!inCall) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [inCall, startTime])

  const fetchConsultation = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/patient-portal/video/${id}`)
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || "Failed to load consultation")
      }
      setData(await res.json())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${String(s).padStart(2, "0")}`
  }

  const getIframeUrl = useCallback(() => {
    if (!data) return ""
    if (data.provider === "daily") {
      const url = new URL(data.roomUrl)
      if (data.token) url.searchParams.set("t", data.token)
      return url.toString()
    }
    const url = new URL(data.roomUrl)
    url.hash = `userInfo.displayName="${encodeURIComponent(data.participantName)}"`
    return url.toString()
  }, [data])

  const joinCall = () => {
    setStartTime(Date.now())
    setInCall(true)
  }

  const leaveCall = () => {
    setInCall(false)
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "SCHEDULED":
        return <Badge className="bg-blue-100 text-blue-700">Scheduled</Badge>
      case "IN_PROGRESS":
        return <Badge className="bg-green-100 text-green-700 animate-pulse">In Progress</Badge>
      case "COMPLETED":
        return <Badge className="bg-gray-100 text-gray-700">Completed</Badge>
      case "CANCELLED":
        return <Badge className="bg-red-100 text-red-700">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error || "Consultation not found"}</p>
        <Link href="/portal/appointments">
          <Button variant="outline" className="mt-4">Back to Appointments</Button>
        </Link>
      </div>
    )
  }

  const { consultation } = data
  const canJoin = consultation.status === "SCHEDULED" || consultation.status === "IN_PROGRESS"

  // In-call view
  if (inCall) {
    return (
      <div className="space-y-0">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900 text-white rounded-t-lg">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-red-600 text-white border-red-600 animate-pulse">
              LIVE
            </Badge>
            <div className="flex items-center gap-1 text-sm">
              <Clock className="h-3 w-3" />
              {formatDuration(elapsed)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">
              Dr. {consultation.doctor.firstName} {consultation.doctor.lastName}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Video */}
        <div className="bg-black">
          <iframe
            ref={iframeRef}
            src={getIframeUrl()}
            className="w-full"
            style={{ border: "none", height: "calc(100vh - 280px)", minHeight: "400px" }}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
          />
        </div>

        {/* Bottom */}
        <div className="flex items-center justify-center px-4 py-3 bg-gray-900 rounded-b-lg">
          <Button
            variant="destructive"
            size="lg"
            onClick={leaveCall}
            className="rounded-full px-6"
          >
            <Phone className="h-5 w-5 mr-2 rotate-[135deg]" />
            Leave Call
          </Button>
        </div>
      </div>
    )
  }

  // Pre-call / post-call view
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/portal/appointments">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Video Consultation</h1>
            {statusBadge(consultation.status)}
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center space-y-6">
            <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center">
              <Video className="h-10 w-10 text-blue-600" />
            </div>

            <div className="text-center space-y-1">
              <h2 className="text-lg font-semibold">
                Dr. {consultation.doctor.firstName} {consultation.doctor.lastName}
              </h2>
              {consultation.doctor.specialization && (
                <p className="text-muted-foreground">{consultation.doctor.specialization}</p>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(new Date(consultation.scheduledAt), "dd MMM yyyy")}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {format(new Date(consultation.scheduledAt), "hh:mm a")}
              </div>
            </div>

            {consultation.appointment?.chiefComplaint && (
              <p className="text-sm text-center max-w-md">
                <span className="text-muted-foreground">Reason: </span>
                {consultation.appointment.chiefComplaint}
              </p>
            )}

            {consultation.duration != null && (
              <p className="text-sm text-muted-foreground">
                Duration: {consultation.duration} minutes
              </p>
            )}

            {canJoin ? (
              <Button size="lg" onClick={joinCall} className="mt-4">
                <Video className="h-5 w-5 mr-2" />
                {consultation.status === "IN_PROGRESS" ? "Join Call" : "Join When Ready"}
              </Button>
            ) : (
              <p className="text-muted-foreground text-sm mt-4">
                {consultation.status === "COMPLETED"
                  ? "This consultation has ended."
                  : "This consultation is not available."}
              </p>
            )}

            {canJoin && (
              <p className="text-xs text-muted-foreground max-w-sm text-center">
                Please ensure you have a stable internet connection and have granted camera and microphone permissions in your browser.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
