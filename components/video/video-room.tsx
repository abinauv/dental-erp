"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Phone,
  MessageSquare,
  FileText,
  Clock,
  User,
  AlertTriangle,
  Maximize,
  Minimize,
} from "lucide-react"

interface PatientInfo {
  id: string
  patientId: string
  firstName: string
  lastName: string
  phone?: string | null
  email?: string | null
  dateOfBirth?: string | null
  gender?: string | null
  medicalHistory?: {
    hasAllergies?: boolean
    drugAllergies?: string | null
    hasDiabetes?: boolean
    hasHypertension?: boolean
    hasHeartDisease?: boolean
  } | null
}

interface VideoRoomProps {
  roomUrl: string
  roomName: string
  token: string | null
  provider: "daily" | "jitsi"
  participantName: string
  isDoctor: boolean
  consultationId: string
  patient?: PatientInfo
  appointment?: {
    appointmentNo: string
    chiefComplaint?: string
  }
  onEnd?: (notes: string) => void
  onStatusChange?: (status: string) => void
}

export default function VideoRoom({
  roomUrl,
  token,
  provider,
  participantName,
  isDoctor,
  consultationId,
  patient,
  appointment,
  onEnd,
  onStatusChange,
}: VideoRoomProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [startTime] = useState(Date.now())
  const [notes, setNotes] = useState("")
  const [showSidebar, setShowSidebar] = useState(isDoctor)
  const [callActive, setCallActive] = useState(true)

  // Timer
  useEffect(() => {
    if (!callActive) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [callActive, startTime])

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    return `${m}:${String(s).padStart(2, "0")}`
  }

  // Build iframe URL
  const getIframeUrl = useCallback(() => {
    if (provider === "daily") {
      const url = new URL(roomUrl)
      if (token) url.searchParams.set("t", token)
      return url.toString()
    }
    // Jitsi
    const url = new URL(roomUrl)
    url.hash = `userInfo.displayName="${encodeURIComponent(participantName)}"`
    return url.toString()
  }, [roomUrl, token, provider, participantName])

  const handleEndCall = () => {
    setCallActive(false)
    onEnd?.(notes)
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

  useEffect(() => {
    const handleFs = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", handleFs)
    return () => document.removeEventListener("fullscreenchange", handleFs)
  }, [])

  if (!callActive) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-center space-y-2">
          <Phone className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">Call Ended</h2>
          <p className="text-muted-foreground">
            Duration: {formatDuration(elapsed)}
          </p>
        </div>
        {isDoctor && (
          <div className="w-full max-w-lg space-y-3">
            <label className="text-sm font-medium">Consultation Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add consultation notes..."
              rows={6}
            />
            <Button onClick={() => onEnd?.(notes)} className="w-full">
              Save Notes & Close
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full gap-4">
      {/* Video Area */}
      <div className="flex-1 flex flex-col min-h-0">
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
            {isDoctor && (
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
                onClick={() => setShowSidebar(!showSidebar)}
              >
                <FileText className="h-4 w-4 mr-1" />
                {showSidebar ? "Hide" : "Show"} Panel
              </Button>
            )}
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

        {/* Video iframe */}
        <div className="flex-1 bg-black relative">
          <iframe
            ref={iframeRef}
            src={getIframeUrl()}
            className="w-full h-full min-h-[400px]"
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            style={{ border: "none" }}
          />
        </div>

        {/* Bottom Controls */}
        <div className="flex items-center justify-center gap-3 px-4 py-3 bg-gray-900 rounded-b-lg">
          <Button
            variant="destructive"
            size="lg"
            onClick={handleEndCall}
            className="rounded-full px-6"
          >
            <Phone className="h-5 w-5 mr-2 rotate-[135deg]" />
            End Call
          </Button>
        </div>
      </div>

      {/* Sidebar — Doctor Only */}
      {isDoctor && showSidebar && (
        <div className="w-80 flex flex-col gap-4 overflow-y-auto">
          {/* Patient Info */}
          {patient && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Patient Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">{patient.firstName} {patient.lastName}</span>
                  <span className="text-muted-foreground ml-2">({patient.patientId})</span>
                </div>
                {patient.phone && <div className="text-muted-foreground">{patient.phone}</div>}
                {patient.gender && (
                  <div className="text-muted-foreground capitalize">{patient.gender.toLowerCase()}</div>
                )}
                {patient.medicalHistory && (
                  <div className="space-y-1 pt-2 border-t">
                    <div className="font-medium text-xs text-muted-foreground uppercase">Medical Alerts</div>
                    {patient.medicalHistory.hasAllergies && (
                      <div className="flex items-center gap-1 text-red-600 text-xs">
                        <AlertTriangle className="h-3 w-3" />
                        Allergies: {patient.medicalHistory.drugAllergies || "Yes"}
                      </div>
                    )}
                    {patient.medicalHistory.hasDiabetes && (
                      <div className="flex items-center gap-1 text-orange-600 text-xs">
                        <AlertTriangle className="h-3 w-3" />
                        Diabetes
                      </div>
                    )}
                    {patient.medicalHistory.hasHypertension && (
                      <div className="flex items-center gap-1 text-orange-600 text-xs">
                        <AlertTriangle className="h-3 w-3" />
                        Hypertension
                      </div>
                    )}
                    {patient.medicalHistory.hasHeartDisease && (
                      <div className="flex items-center gap-1 text-red-600 text-xs">
                        <AlertTriangle className="h-3 w-3" />
                        Heart Disease
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Appointment Details */}
          {appointment && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Appointment</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <div className="text-muted-foreground">{appointment.appointmentNo}</div>
                {appointment.chiefComplaint && (
                  <div>
                    <span className="text-muted-foreground">Complaint:</span>{" "}
                    {appointment.chiefComplaint}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Consultation Notes */}
          <Card className="flex-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Consultation Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Type notes during the consultation..."
                rows={8}
                className="text-sm"
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
