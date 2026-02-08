"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CalendarPlus,
  User,
  Calendar,
  Clock,
  Loader2,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Doctor {
  id: string
  firstName: string
  lastName: string
  specialization: string | null
}

interface Slot {
  time: string
  available: boolean
}

type Step = 1 | 2 | 3 | 4

export default function BookAppointment() {
  const router = useRouter()

  const [step, setStep] = useState<Step>(1)
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [doctorsLoading, setDoctorsLoading] = useState(true)

  // Form state
  const [selectedDoctor, setSelectedDoctor] = useState("")
  const [selectedDate, setSelectedDate] = useState("")
  const [selectedTime, setSelectedTime] = useState("")
  const [chiefComplaint, setChiefComplaint] = useState("")

  // Slots state
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)

  // Booking state
  const [booking, setBooking] = useState(false)
  const [bookingResult, setBookingResult] = useState<any>(null)
  const [error, setError] = useState("")

  // Fetch doctors on mount — uses portal API which provides hospitalId
  useEffect(() => {
    // We need to know the hospital slug. Get it from the portal context cookie
    // by calling the dashboard API which requires auth.
    fetch("/api/patient-portal/appointments?filter=upcoming&limit=0")
      .then(() => {
        // The slug comes from the portal layout context.
        // For booking, we use the patient portal appointment API directly.
      })
      .catch(() => {})

    // Fetch doctors via a helper that reads from the portal auth context
    fetchDoctors()
  }, [])

  const fetchDoctors = async () => {
    setDoctorsLoading(true)
    try {
      const res = await fetch("/api/patient-portal/doctors")
      if (res.ok) {
        const data = await res.json()
        setDoctors(data.doctors || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setDoctorsLoading(false)
    }
  }

  const fetchSlots = useCallback(async () => {
    if (!selectedDoctor || !selectedDate) return
    setSlotsLoading(true)
    setSelectedTime("")
    try {
      const res = await fetch(
        `/api/patient-portal/slots?doctorId=${selectedDoctor}&date=${selectedDate}`
      )
      if (res.ok) {
        const data = await res.json()
        setSlots(data.slots || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSlotsLoading(false)
    }
  }, [selectedDoctor, selectedDate])

  useEffect(() => {
    if (selectedDoctor && selectedDate) {
      fetchSlots()
    }
  }, [selectedDoctor, selectedDate, fetchSlots])

  const handleBook = async () => {
    setBooking(true)
    setError("")
    try {
      const res = await fetch("/api/patient-portal/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: selectedDoctor,
          date: selectedDate,
          time: selectedTime,
          type: "CONSULTATION",
          chiefComplaint: chiefComplaint || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Booking failed")
        return
      }

      setBookingResult(data.appointment)
      setStep(4)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setBooking(false)
    }
  }

  const selectedDoctorObj = doctors.find((d) => d.id === selectedDoctor)
  const availableSlots = slots.filter((s) => s.available)

  // Minimum date: today
  const today = new Date().toISOString().split("T")[0]

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/portal/appointments")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Book Appointment</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={cn(
              "h-2 flex-1 rounded-full transition-colors",
              s <= step ? "bg-primary" : "bg-gray-200"
            )}
          />
        ))}
      </div>

      {/* Step 1: Select Doctor */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" /> Select Doctor
            </CardTitle>
            <CardDescription>Choose your preferred doctor</CardDescription>
          </CardHeader>
          <CardContent>
            {doctorsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : doctors.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No doctors available for booking
              </p>
            ) : (
              <div className="space-y-2">
                {doctors.map((doc) => (
                  <div
                    key={doc.id}
                    className={cn(
                      "p-3 rounded-lg border-2 cursor-pointer transition-colors",
                      selectedDoctor === doc.id
                        ? "border-primary bg-primary/5"
                        : "border-transparent bg-gray-50 hover:bg-gray-100"
                    )}
                    onClick={() => setSelectedDoctor(doc.id)}
                  >
                    <p className="font-medium">
                      Dr. {doc.firstName} {doc.lastName}
                    </p>
                    {doc.specialization && (
                      <p className="text-sm text-muted-foreground">{doc.specialization}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Button
              className="w-full mt-4"
              disabled={!selectedDoctor}
              onClick={() => setStep(2)}
            >
              Continue <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Select Date & Time */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" /> Select Date & Time
            </CardTitle>
            <CardDescription>
              {selectedDoctorObj && (
                <>Dr. {selectedDoctorObj.firstName} {selectedDoctorObj.lastName}</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                min={today}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            {selectedDate && (
              <div className="space-y-2">
                <Label>Available Time Slots</Label>
                {slotsLoading ? (
                  <Skeleton className="h-32" />
                ) : availableSlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No slots available on this date
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {slots.map((slot) => (
                      <Button
                        key={slot.time}
                        variant={selectedTime === slot.time ? "default" : "outline"}
                        size="sm"
                        disabled={!slot.available}
                        onClick={() => setSelectedTime(slot.time)}
                        className={cn(
                          "text-xs",
                          !slot.available && "opacity-40 line-through"
                        )}
                      >
                        {slot.time}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <Button
                className="flex-1"
                disabled={!selectedTime}
                onClick={() => setStep(3)}
              >
                Continue <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5" /> Confirm Booking
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
            )}

            <div className="p-4 rounded-lg bg-gray-50 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Doctor</span>
                <span className="font-medium">
                  Dr. {selectedDoctorObj?.firstName} {selectedDoctorObj?.lastName}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">
                  {new Date(selectedDate).toLocaleDateString("en-IN", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Time</span>
                <span className="font-medium">{selectedTime}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reason for visit (optional)</Label>
              <Textarea
                placeholder="Describe your dental concern..."
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <Button className="flex-1" onClick={handleBook} disabled={booking}>
                {booking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm Booking
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Success */}
      {step === 4 && bookingResult && (
        <Card>
          <CardContent className="py-8 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold text-green-700">Booking Confirmed!</h2>
            <div className="p-4 rounded-lg bg-green-50 space-y-2 text-sm">
              <p><strong>Appointment:</strong> {bookingResult.appointmentNo}</p>
              <p><strong>Doctor:</strong> {bookingResult.doctor?.firstName ? `Dr. ${bookingResult.doctor.firstName} ${bookingResult.doctor.lastName}` : selectedDoctorObj ? `Dr. ${selectedDoctorObj.firstName} ${selectedDoctorObj.lastName}` : ""}</p>
              <p><strong>Date:</strong> {new Date(selectedDate).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
              <p><strong>Time:</strong> {selectedTime}</p>
            </div>
            <Button onClick={() => router.push("/portal/appointments")}>
              View My Appointments
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
