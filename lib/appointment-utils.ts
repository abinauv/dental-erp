// Appointment status colors and labels
export const appointmentStatusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  SCHEDULED: {
    label: "Scheduled",
    color: "text-blue-700",
    bgColor: "bg-blue-100"
  },
  CONFIRMED: {
    label: "Confirmed",
    color: "text-indigo-700",
    bgColor: "bg-indigo-100"
  },
  CHECKED_IN: {
    label: "Checked In",
    color: "text-amber-700",
    bgColor: "bg-amber-100"
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "text-purple-700",
    bgColor: "bg-purple-100"
  },
  COMPLETED: {
    label: "Completed",
    color: "text-green-700",
    bgColor: "bg-green-100"
  },
  CANCELLED: {
    label: "Cancelled",
    color: "text-muted-foreground",
    bgColor: "bg-muted"
  },
  NO_SHOW: {
    label: "No Show",
    color: "text-red-700",
    bgColor: "bg-red-100"
  },
  RESCHEDULED: {
    label: "Rescheduled",
    color: "text-orange-700",
    bgColor: "bg-orange-100"
  }
}

export const appointmentTypeConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  CONSULTATION: {
    label: "Consultation",
    color: "text-blue-700",
    bgColor: "bg-blue-50"
  },
  PROCEDURE: {
    label: "Procedure",
    color: "text-purple-700",
    bgColor: "bg-purple-50"
  },
  FOLLOW_UP: {
    label: "Follow Up",
    color: "text-teal-700",
    bgColor: "bg-teal-50"
  },
  EMERGENCY: {
    label: "Emergency",
    color: "text-red-700",
    bgColor: "bg-red-50"
  },
  CHECK_UP: {
    label: "Check Up",
    color: "text-green-700",
    bgColor: "bg-green-50"
  }
}

export const priorityConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  LOW: {
    label: "Low",
    color: "text-muted-foreground",
    bgColor: "bg-muted"
  },
  NORMAL: {
    label: "Normal",
    color: "text-blue-600",
    bgColor: "bg-blue-100"
  },
  HIGH: {
    label: "High",
    color: "text-orange-600",
    bgColor: "bg-orange-100"
  },
  URGENT: {
    label: "Urgent",
    color: "text-red-600",
    bgColor: "bg-red-100"
  }
}

// Format time string (24h to 12h format)
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`
}

// Format date for display
export function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

// Format date for API
export function formatDateForApi(date: Date): string {
  return date.toISOString().split('T')[0]
}

// Check if date is today
export function isToday(date: Date | string): boolean {
  const d = new Date(date)
  const today = new Date()
  return d.toDateString() === today.toDateString()
}

// Get patient full name
export function getPatientName(patient: { firstName: string; lastName: string }): string {
  return `${patient.firstName} ${patient.lastName}`
}

// Get doctor full name
export function getDoctorName(doctor: { firstName: string; lastName: string }): string {
  return `Dr. ${doctor.firstName} ${doctor.lastName}`
}
