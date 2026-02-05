import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: Date | string): string {
  try {
    const d = new Date(date)
    if (isNaN(d.getTime())) return '-'
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d)
  } catch {
    return '-'
  }
}

export function formatDateTime(date: Date | string): string {
  const d = new Date(date)
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function formatPhone(phone: string): string {
  if (!phone) return ''
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`
  }
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`
  }
  return phone
}

export function generatePatientId(): string {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = String(date.getFullYear()).slice(-2)
  const random = String(Math.floor(Math.random() * 9999)).padStart(4, '0')
  return `PAT${year}${month}${random}`
}

export function generateInvoiceNo(): string {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = String(date.getFullYear())
  const random = String(Math.floor(Math.random() * 9999)).padStart(4, '0')
  return `INV-${year}${month}-${random}`
}

export function calculateGST(amount: number, cgstRate: number = 9, sgstRate: number = 9) {
  const cgst = (amount * cgstRate) / 100
  const sgst = (amount * sgstRate) / 100
  return {
    subtotal: amount,
    cgst,
    sgst,
    total: amount + cgst + sgst,
  }
}

export function validateAadhar(aadhar: string): boolean {
  const cleaned = aadhar.replace(/\D/g, '')
  return cleaned.length === 12
}

export function validateIndianPhone(phone: string): boolean {
  let cleaned = phone.replace(/\D/g, '')
  // Strip country code if present
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    cleaned = cleaned.slice(2)
  }
  return /^[6-9]\d{9}$/.test(cleaned)
}
