// Treatment status colors and labels
export const treatmentStatusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  PLANNED: {
    label: "Planned",
    color: "text-blue-700",
    bgColor: "bg-blue-100"
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "text-amber-700",
    bgColor: "bg-amber-100"
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
  }
}

// Treatment Plan status colors and labels
export const treatmentPlanStatusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  DRAFT: {
    label: "Draft",
    color: "text-muted-foreground",
    bgColor: "bg-muted"
  },
  PROPOSED: {
    label: "Proposed",
    color: "text-blue-700",
    bgColor: "bg-blue-100"
  },
  ACCEPTED: {
    label: "Accepted",
    color: "text-indigo-700",
    bgColor: "bg-indigo-100"
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "text-amber-700",
    bgColor: "bg-amber-100"
  },
  COMPLETED: {
    label: "Completed",
    color: "text-green-700",
    bgColor: "bg-green-100"
  },
  CANCELLED: {
    label: "Cancelled",
    color: "text-red-700",
    bgColor: "bg-red-100"
  }
}

// Treatment Plan Item status colors and labels
export const treatmentPlanItemStatusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  PENDING: {
    label: "Pending",
    color: "text-muted-foreground",
    bgColor: "bg-muted"
  },
  SCHEDULED: {
    label: "Scheduled",
    color: "text-blue-700",
    bgColor: "bg-blue-100"
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "text-amber-700",
    bgColor: "bg-amber-100"
  },
  COMPLETED: {
    label: "Completed",
    color: "text-green-700",
    bgColor: "bg-green-100"
  },
  CANCELLED: {
    label: "Cancelled",
    color: "text-red-700",
    bgColor: "bg-red-100"
  }
}

// Procedure category colors and labels
export const procedureCategoryConfig: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
  PREVENTIVE: {
    label: "Preventive",
    color: "text-green-700",
    bgColor: "bg-green-100",
    icon: "Shield"
  },
  RESTORATIVE: {
    label: "Restorative",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    icon: "Wrench"
  },
  ENDODONTIC: {
    label: "Endodontic",
    color: "text-purple-700",
    bgColor: "bg-purple-100",
    icon: "Target"
  },
  PERIODONTIC: {
    label: "Periodontic",
    color: "text-pink-700",
    bgColor: "bg-pink-100",
    icon: "Layers"
  },
  PROSTHODONTIC: {
    label: "Prosthodontic",
    color: "text-indigo-700",
    bgColor: "bg-indigo-100",
    icon: "Crown"
  },
  ORTHODONTIC: {
    label: "Orthodontic",
    color: "text-cyan-700",
    bgColor: "bg-cyan-100",
    icon: "AlignCenter"
  },
  ORAL_SURGERY: {
    label: "Oral Surgery",
    color: "text-red-700",
    bgColor: "bg-red-100",
    icon: "Scissors"
  },
  COSMETIC: {
    label: "Cosmetic",
    color: "text-amber-700",
    bgColor: "bg-amber-100",
    icon: "Sparkles"
  },
  DIAGNOSTIC: {
    label: "Diagnostic",
    color: "text-teal-700",
    bgColor: "bg-teal-100",
    icon: "Search"
  },
  EMERGENCY: {
    label: "Emergency",
    color: "text-orange-700",
    bgColor: "bg-orange-100",
    icon: "AlertTriangle"
  }
}

// Dental chart tooth condition colors and labels
export const toothConditionConfig: Record<string, { label: string; color: string; bgColor: string; fillColor: string }> = {
  HEALTHY: {
    label: "Healthy",
    color: "text-green-700",
    bgColor: "bg-green-100",
    fillColor: "#22c55e"
  },
  CARIES: {
    label: "Caries",
    color: "text-red-700",
    bgColor: "bg-red-100",
    fillColor: "#ef4444"
  },
  FILLED: {
    label: "Filled",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    fillColor: "#3b82f6"
  },
  CROWN: {
    label: "Crown",
    color: "text-amber-700",
    bgColor: "bg-amber-100",
    fillColor: "#f59e0b"
  },
  BRIDGE: {
    label: "Bridge",
    color: "text-purple-700",
    bgColor: "bg-purple-100",
    fillColor: "#a855f7"
  },
  MISSING: {
    label: "Missing",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    fillColor: "#9ca3af"
  },
  IMPLANT: {
    label: "Implant",
    color: "text-cyan-700",
    bgColor: "bg-cyan-100",
    fillColor: "#06b6d4"
  },
  ROOT_CANAL: {
    label: "Root Canal",
    color: "text-pink-700",
    bgColor: "bg-pink-100",
    fillColor: "#ec4899"
  },
  EXTRACTION_NEEDED: {
    label: "Extraction Needed",
    color: "text-orange-700",
    bgColor: "bg-orange-100",
    fillColor: "#f97316"
  },
  VENEER: {
    label: "Veneer",
    color: "text-indigo-700",
    bgColor: "bg-indigo-100",
    fillColor: "#6366f1"
  }
}

// Tooth surface labels (FDI notation)
export const toothSurfaceLabels: Record<string, string> = {
  M: "Mesial",
  D: "Distal",
  O: "Occlusal",
  B: "Buccal",
  L: "Lingual",
  I: "Incisal",
  F: "Facial",
  P: "Palatal"
}

// Tooth numbering (Universal/FDI)
export const toothNumbers = {
  // Upper Right (Quadrant 1)
  upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
  // Upper Left (Quadrant 2)
  upperLeft: [21, 22, 23, 24, 25, 26, 27, 28],
  // Lower Left (Quadrant 3)
  lowerLeft: [38, 37, 36, 35, 34, 33, 32, 31],
  // Lower Right (Quadrant 4)
  lowerRight: [41, 42, 43, 44, 45, 46, 47, 48]
}

// Tooth names by number (FDI notation)
export const toothNames: Record<number, string> = {
  // Upper Right
  18: "Upper Right Third Molar",
  17: "Upper Right Second Molar",
  16: "Upper Right First Molar",
  15: "Upper Right Second Premolar",
  14: "Upper Right First Premolar",
  13: "Upper Right Canine",
  12: "Upper Right Lateral Incisor",
  11: "Upper Right Central Incisor",
  // Upper Left
  21: "Upper Left Central Incisor",
  22: "Upper Left Lateral Incisor",
  23: "Upper Left Canine",
  24: "Upper Left First Premolar",
  25: "Upper Left Second Premolar",
  26: "Upper Left First Molar",
  27: "Upper Left Second Molar",
  28: "Upper Left Third Molar",
  // Lower Left
  31: "Lower Left Central Incisor",
  32: "Lower Left Lateral Incisor",
  33: "Lower Left Canine",
  34: "Lower Left First Premolar",
  35: "Lower Left Second Premolar",
  36: "Lower Left First Molar",
  37: "Lower Left Second Molar",
  38: "Lower Left Third Molar",
  // Lower Right
  41: "Lower Right Central Incisor",
  42: "Lower Right Lateral Incisor",
  43: "Lower Right Canine",
  44: "Lower Right First Premolar",
  45: "Lower Right Second Premolar",
  46: "Lower Right First Molar",
  47: "Lower Right Second Molar",
  48: "Lower Right Third Molar"
}

// Format treatment duration in minutes to readable string
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) {
    return `${hours} hr`
  }
  return `${hours} hr ${mins} min`
}

// Format currency for Indian Rupees
export function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(num)
}

// Parse tooth numbers from string (e.g., "11,12,13" or "11-13")
export function parseToothNumbers(toothString: string): number[] {
  if (!toothString) return []

  const teeth: number[] = []
  const parts = toothString.split(',').map(s => s.trim())

  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number)
      for (let i = start; i <= end; i++) {
        teeth.push(i)
      }
    } else {
      const num = parseInt(part, 10)
      if (!isNaN(num)) {
        teeth.push(num)
      }
    }
  }

  return [...new Set(teeth)].sort((a, b) => a - b)
}

// Format tooth numbers to string
export function formatToothNumbers(teeth: number[]): string {
  if (!teeth || teeth.length === 0) return '-'
  return teeth.sort((a, b) => a - b).join(', ')
}

// Get tooth quadrant from tooth number
export function getToothQuadrant(toothNumber: number): 1 | 2 | 3 | 4 {
  const firstDigit = Math.floor(toothNumber / 10)
  return firstDigit as 1 | 2 | 3 | 4
}

// Check if tooth is a molar
export function isMolar(toothNumber: number): boolean {
  const lastDigit = toothNumber % 10
  return lastDigit >= 6 && lastDigit <= 8
}

// Check if tooth is a premolar
export function isPremolar(toothNumber: number): boolean {
  const lastDigit = toothNumber % 10
  return lastDigit === 4 || lastDigit === 5
}

// Check if tooth is a canine
export function isCanine(toothNumber: number): boolean {
  const lastDigit = toothNumber % 10
  return lastDigit === 3
}

// Check if tooth is an incisor
export function isIncisor(toothNumber: number): boolean {
  const lastDigit = toothNumber % 10
  return lastDigit === 1 || lastDigit === 2
}

// Get tooth type
export function getToothType(toothNumber: number): 'molar' | 'premolar' | 'canine' | 'incisor' {
  if (isMolar(toothNumber)) return 'molar'
  if (isPremolar(toothNumber)) return 'premolar'
  if (isCanine(toothNumber)) return 'canine'
  return 'incisor'
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

// Format date and time
export function formatDateTime(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

// Calculate treatment plan progress percentage
export function calculatePlanProgress(items: { status: string }[]): number {
  if (!items || items.length === 0) return 0
  const completed = items.filter(item => item.status === 'COMPLETED').length
  return Math.round((completed / items.length) * 100)
}

// Get treatment status badge component props
export function getTreatmentStatusBadge(status: string): { label: string; variant: string } {
  const config = treatmentStatusConfig[status] || treatmentStatusConfig.PLANNED
  return {
    label: config.label,
    variant: status.toLowerCase()
  }
}
