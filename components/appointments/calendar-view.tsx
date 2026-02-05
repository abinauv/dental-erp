"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  User,
} from "lucide-react"
import {
  appointmentStatusConfig,
  formatTime,
  getPatientName,
  getDoctorName,
} from "@/lib/appointment-utils"

interface Appointment {
  id: string
  appointmentNo: string
  scheduledDate: string
  scheduledTime: string
  duration: number
  appointmentType: string
  status: string
  patient: {
    firstName: string
    lastName: string
    phone: string
  }
  doctor: {
    firstName: string
    lastName: string
  }
}

interface CalendarViewProps {
  initialDate?: Date
}

export function CalendarView({ initialDate = new Date() }: CalendarViewProps) {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(initialDate)
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("week")
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAppointments = async () => {
    try {
      setLoading(true)
      const dateStr = currentDate.toISOString().split("T")[0]
      const response = await fetch(
        `/api/appointments?view=${viewMode}&date=${dateStr}`
      )
      if (response.ok) {
        const data = await response.json()
        setAppointments(data.appointments)
      }
    } catch (error) {
      console.error("Error fetching appointments:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAppointments()
  }, [currentDate, viewMode])

  const navigatePrevious = () => {
    const newDate = new Date(currentDate)
    if (viewMode === "day") {
      newDate.setDate(newDate.getDate() - 1)
    } else if (viewMode === "week") {
      newDate.setDate(newDate.getDate() - 7)
    } else {
      newDate.setMonth(newDate.getMonth() - 1)
    }
    setCurrentDate(newDate)
  }

  const navigateNext = () => {
    const newDate = new Date(currentDate)
    if (viewMode === "day") {
      newDate.setDate(newDate.getDate() + 1)
    } else if (viewMode === "week") {
      newDate.setDate(newDate.getDate() + 7)
    } else {
      newDate.setMonth(newDate.getMonth() + 1)
    }
    setCurrentDate(newDate)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const getDateLabel = () => {
    if (viewMode === "day") {
      return currentDate.toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    } else if (viewMode === "week") {
      const weekStart = new Date(currentDate)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      return `${weekStart.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      })} - ${weekEnd.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}`
    } else {
      return currentDate.toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      })
    }
  }

  const getWeekDays = () => {
    const days = []
    const weekStart = new Date(currentDate)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())

    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart)
      day.setDate(day.getDate() + i)
      days.push(day)
    }
    return days
  }

  const getMonthDays = () => {
    const days = []
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

    // Add days from previous month to fill the first week
    const firstDayOfWeek = monthStart.getDay()
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = new Date(monthStart)
      day.setDate(day.getDate() - i - 1)
      days.push({ date: day, isCurrentMonth: false })
    }

    // Add days of current month
    for (let i = 1; i <= monthEnd.getDate(); i++) {
      days.push({
        date: new Date(currentDate.getFullYear(), currentDate.getMonth(), i),
        isCurrentMonth: true,
      })
    }

    // Add days from next month to fill the last week
    const remainingDays = 42 - days.length // 6 weeks * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      const day = new Date(monthEnd)
      day.setDate(day.getDate() + i)
      days.push({ date: day, isCurrentMonth: false })
    }

    return days
  }

  const getAppointmentsForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0]
    return appointments.filter(
      (apt) => new Date(apt.scheduledDate).toISOString().split("T")[0] === dateStr
    )
  }

  const timeSlots = [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
    "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
    "18:00", "18:30", "19:00", "19:30", "20:00", "20:30"
  ]

  const getStatusColor = (status: string) => {
    const config = appointmentStatusConfig[status]
    return config?.bgColor || "bg-gray-100"
  }

  const renderDayView = () => {
    const dayAppointments = getAppointmentsForDate(currentDate)

    return (
      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[80px_1fr] divide-x">
          {/* Time column */}
          <div className="bg-muted/30">
            {timeSlots.map((time) => (
              <div
                key={time}
                className="h-16 border-b px-2 py-1 text-xs text-muted-foreground"
              >
                {formatTime(time)}
              </div>
            ))}
          </div>

          {/* Appointments column */}
          <div className="relative">
            {timeSlots.map((time) => (
              <div key={time} className="h-16 border-b" />
            ))}

            {/* Render appointments */}
            {dayAppointments.map((apt) => {
              const startIndex = timeSlots.indexOf(apt.scheduledTime)
              if (startIndex === -1) return null

              const slotsSpan = Math.ceil(apt.duration / 30)
              const top = startIndex * 64 // 64px = 4rem = h-16
              const height = slotsSpan * 64

              return (
                <div
                  key={apt.id}
                  className={`absolute left-1 right-1 rounded-md p-2 cursor-pointer ${getStatusColor(apt.status)}`}
                  style={{ top: `${top}px`, height: `${height - 4}px` }}
                  onClick={() => router.push(`/appointments/${apt.id}`)}
                >
                  <p className="font-medium text-sm truncate">
                    {getPatientName(apt.patient)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {formatTime(apt.scheduledTime)} - {getDoctorName(apt.doctor)}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  const renderWeekView = () => {
    const weekDays = getWeekDays()

    return (
      <div className="border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[80px_repeat(7,1fr)] divide-x bg-muted/30">
          <div className="p-2" />
          {weekDays.map((day) => (
            <div
              key={day.toISOString()}
              className={`p-2 text-center ${
                day.toDateString() === new Date().toDateString()
                  ? "bg-primary/10"
                  : ""
              }`}
            >
              <p className="text-xs text-muted-foreground">
                {day.toLocaleDateString("en-IN", { weekday: "short" })}
              </p>
              <p className="font-semibold">{day.getDate()}</p>
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div className="grid grid-cols-[80px_repeat(7,1fr)] divide-x">
          {/* Time column */}
          <div className="bg-muted/30">
            {timeSlots.map((time) => (
              <div
                key={time}
                className="h-12 border-b px-2 py-1 text-xs text-muted-foreground"
              >
                {formatTime(time)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day) => {
            const dayAppointments = getAppointmentsForDate(day)

            return (
              <div key={day.toISOString()} className="relative">
                {timeSlots.map((time) => (
                  <div key={time} className="h-12 border-b" />
                ))}

                {dayAppointments.map((apt) => {
                  const startIndex = timeSlots.indexOf(apt.scheduledTime)
                  if (startIndex === -1) return null

                  const slotsSpan = Math.ceil(apt.duration / 30)
                  const top = startIndex * 48 // 48px = 3rem = h-12
                  const height = slotsSpan * 48

                  return (
                    <div
                      key={apt.id}
                      className={`absolute left-0.5 right-0.5 rounded p-1 cursor-pointer text-xs ${getStatusColor(apt.status)}`}
                      style={{ top: `${top}px`, height: `${height - 2}px` }}
                      onClick={() => router.push(`/appointments/${apt.id}`)}
                    >
                      <p className="font-medium truncate">
                        {apt.patient.firstName}
                      </p>
                      <p className="text-muted-foreground truncate">
                        {formatTime(apt.scheduledTime)}
                      </p>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderMonthView = () => {
    const monthDays = getMonthDays()

    return (
      <div className="border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-7 bg-muted/30">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="p-2 text-center text-sm font-medium">
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7">
          {monthDays.map(({ date, isCurrentMonth }, index) => {
            const dayAppointments = getAppointmentsForDate(date)
            const isToday = date.toDateString() === new Date().toDateString()

            return (
              <div
                key={index}
                className={`min-h-24 border-b border-r p-1 ${
                  !isCurrentMonth ? "bg-muted/20" : ""
                } ${isToday ? "bg-primary/5" : ""}`}
              >
                <p
                  className={`text-sm mb-1 ${
                    !isCurrentMonth
                      ? "text-muted-foreground"
                      : isToday
                      ? "font-bold text-primary"
                      : ""
                  }`}
                >
                  {date.getDate()}
                </p>
                <div className="space-y-1">
                  {dayAppointments.slice(0, 3).map((apt) => (
                    <div
                      key={apt.id}
                      className={`text-xs p-1 rounded cursor-pointer truncate ${getStatusColor(apt.status)}`}
                      onClick={() => router.push(`/appointments/${apt.id}`)}
                    >
                      {formatTime(apt.scheduledTime)} {apt.patient.firstName}
                    </div>
                  ))}
                  {dayAppointments.length > 3 && (
                    <p className="text-xs text-muted-foreground pl-1">
                      +{dayAppointments.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={navigatePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <h2 className="text-lg font-semibold ml-2">{getDateLabel()}</h2>
        </div>

        <Select
          value={viewMode}
          onValueChange={(value) => setViewMode(value as "day" | "week" | "month")}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Day</SelectItem>
            <SelectItem value="week">Week</SelectItem>
            <SelectItem value="month">Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Calendar Content */}
      {loading ? (
        <div className="flex items-center justify-center h-96">
          <div className="animate-pulse text-muted-foreground">
            Loading calendar...
          </div>
        </div>
      ) : (
        <>
          {viewMode === "day" && renderDayView()}
          {viewMode === "week" && renderWeekView()}
          {viewMode === "month" && renderMonthView()}
        </>
      )}

      {/* Legend */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 text-sm">
            {Object.entries(appointmentStatusConfig).map(([key, config]) => (
              <div key={key} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded ${config.bgColor}`} />
                <span>{config.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
