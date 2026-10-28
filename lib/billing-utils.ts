// Billing & Financial Management Utilities

import {
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  InsuranceClaimStatus,
  DiscountType,
} from '@prisma/client'
import {
  formatCurrency as baseFormatCurrency,
  formatDate as baseFormatDate,
  formatDateTime as baseFormatDateTime,
} from '@/lib/i18n/format'
import { getTaxProvider, type TaxComponent } from '@/lib/tax'
import { getLocaleDefaults } from '@/lib/i18n/config'

// Invoice Status Configuration
export const invoiceStatusConfig: Record<
  InvoiceStatus,
  {
    label: string
    color: string
    bgColor: string
    description: string
  }
> = {
  DRAFT: {
    label: 'Draft',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    description: 'Invoice is being prepared',
  },
  PENDING: {
    label: 'Pending',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    description: 'Invoice sent, awaiting payment',
  },
  PARTIALLY_PAID: {
    label: 'Partially Paid',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    description: 'Partial payment received',
  },
  PAID: {
    label: 'Paid',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    description: 'Full payment received',
  },
  OVERDUE: {
    label: 'Overdue',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    description: 'Payment past due date',
  },
  CANCELLED: {
    label: 'Cancelled',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    description: 'Invoice has been cancelled',
  },
  REFUNDED: {
    label: 'Refunded',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    description: 'Payment has been refunded',
  },
}

// Payment Method Configuration
export const paymentMethodConfig: Record<
  PaymentMethod,
  {
    label: string
    icon: string
    description: string
  }
> = {
  CASH: {
    label: 'Cash',
    icon: 'Banknote',
    description: 'Cash payment',
  },
  CARD: {
    label: 'Card',
    icon: 'CreditCard',
    description: 'Debit/Credit card',
  },
  UPI: {
    label: 'UPI',
    icon: 'Smartphone',
    description: 'UPI payment (GPay, PhonePe, etc.)',
  },
  BANK_TRANSFER: {
    label: 'Bank Transfer',
    icon: 'Building2',
    description: 'NEFT/RTGS/IMPS',
  },
  CHEQUE: {
    label: 'Cheque',
    icon: 'FileText',
    description: 'Cheque payment',
  },
  INSURANCE: {
    label: 'Insurance',
    icon: 'Shield',
    description: 'Insurance claim payment',
  },
  WALLET: {
    label: 'Wallet',
    icon: 'Wallet',
    description: 'Digital wallet',
  },
  ONLINE: {
    label: 'Online',
    icon: 'Globe',
    description: 'Online payment gateway',
  },
}

// Payment Status Configuration
export const paymentStatusConfig: Record<
  PaymentStatus,
  {
    label: string
    color: string
    bgColor: string
  }
> = {
  PENDING: {
    label: 'Pending',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
  },
  COMPLETED: {
    label: 'Completed',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  FAILED: {
    label: 'Failed',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
  },
  REFUNDED: {
    label: 'Refunded',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
  },
  CANCELLED: {
    label: 'Cancelled',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  },
}

// Insurance Claim Status Configuration
export const insuranceClaimStatusConfig: Record<
  InsuranceClaimStatus,
  {
    label: string
    color: string
    bgColor: string
    description: string
  }
> = {
  DRAFT: {
    label: 'Draft',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    description: 'Claim is being prepared',
  },
  SUBMITTED: {
    label: 'Submitted',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    description: 'Claim submitted to insurer',
  },
  UNDER_REVIEW: {
    label: 'Under Review',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    description: 'Insurer is reviewing the claim',
  },
  APPROVED: {
    label: 'Approved',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    description: 'Claim approved by insurer',
  },
  PARTIALLY_APPROVED: {
    label: 'Partially Approved',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    description: 'Claim partially approved',
  },
  REJECTED: {
    label: 'Rejected',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    description: 'Claim rejected by insurer',
  },
  SETTLED: {
    label: 'Settled',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-100',
    description: 'Payment received from insurer',
  },
}

// Discount Type Configuration
export const discountTypeConfig: Record<
  DiscountType,
  {
    label: string
    symbol: string
  }
> = {
  PERCENTAGE: {
    label: 'Percentage',
    symbol: '%',
  },
  FIXED: {
    label: 'Fixed Amount',
    symbol: '₹',
  },
}

// GST Configuration (Indian Tax)
export const gstConfig = {
  cgstRate: 9, // Central GST
  sgstRate: 9, // State GST
  igstRate: 18, // Integrated GST (for inter-state)
  defaultTaxable: true,
}

// Calculate GST breakdown
export function calculateGST(
  subtotal: number,
  cgstRate: number = gstConfig.cgstRate,
  sgstRate: number = gstConfig.sgstRate
): {
  subtotal: number
  cgstAmount: number
  sgstAmount: number
  totalTax: number
  grandTotal: number
} {
  const cgstAmount = (subtotal * cgstRate) / 100
  const sgstAmount = (subtotal * sgstRate) / 100
  const totalTax = cgstAmount + sgstAmount
  const grandTotal = subtotal + totalTax

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    cgstAmount: Math.round(cgstAmount * 100) / 100,
    sgstAmount: Math.round(sgstAmount * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100,
  }
}

// Calculate discount
export function calculateDiscount(
  subtotal: number,
  discountType: DiscountType,
  discountValue: number
): {
  discountAmount: number
  afterDiscount: number
} {
  let discountAmount: number

  if (discountType === 'PERCENTAGE') {
    discountAmount = (subtotal * discountValue) / 100
  } else {
    discountAmount = discountValue
  }

  // Ensure discount doesn't exceed subtotal
  discountAmount = Math.min(discountAmount, subtotal)

  return {
    discountAmount: Math.round(discountAmount * 100) / 100,
    afterDiscount: Math.round((subtotal - discountAmount) * 100) / 100,
  }
}

// Optional tax context: which country's provider to use and, for India, where
// the supply is consumed (patient region) versus the clinic's own region, which
// decides the intra-state (CGST+SGST) vs inter-state (IGST) split. Omitted, it
// behaves exactly as before: India GST, intra-state, CGST+SGST at cgstRate/sgstRate.
export interface InvoiceTaxContext {
  country?: string
  placeOfSupply?: string
  clinicRegion?: string
  igstRate?: number
}

// Calculate invoice totals
export function calculateInvoiceTotals(
  items: Array<{ quantity: number; unitPrice: number; taxable: boolean }>,
  discountType: DiscountType = 'FIXED',
  discountValue: number = 0,
  cgstRate: number = gstConfig.cgstRate,
  sgstRate: number = gstConfig.sgstRate,
  taxContext?: InvoiceTaxContext
): {
  subtotal: number
  discountAmount: number
  taxableAmount: number
  nonTaxableAmount: number
  cgstAmount: number
  sgstAmount: number
  totalTax: number
  totalAmount: number
  taxComponents: TaxComponent[]
  taxAmount: number
} {
  // Calculate subtotals
  let taxableSubtotal = 0
  let nonTaxableSubtotal = 0

  items.forEach((item) => {
    const itemTotal = item.quantity * item.unitPrice
    if (item.taxable) {
      taxableSubtotal += itemTotal
    } else {
      nonTaxableSubtotal += itemTotal
    }
  })

  const subtotal = taxableSubtotal + nonTaxableSubtotal

  // Apply discount proportionally
  const { discountAmount } = calculateDiscount(subtotal, discountType, discountValue)

  // Proportional discount for taxable amount
  const taxableDiscountRatio = subtotal > 0 ? taxableSubtotal / subtotal : 0
  const taxableDiscount = discountAmount * taxableDiscountRatio
  const taxableAmount = taxableSubtotal - taxableDiscount
  const nonTaxableAmount = nonTaxableSubtotal - (discountAmount - taxableDiscount)

  // Compute tax on the taxable amount via the country's provider. With no
  // context this resolves to India GST intra-state (CGST+SGST), identical to
  // the previous inline maths.
  const provider = getTaxProvider(taxContext?.country)
  const taxResult = provider.calculate(taxableAmount, {
    placeOfSupply: taxContext?.placeOfSupply,
    clinicRegion: taxContext?.clinicRegion,
    rates: { cgstRate, sgstRate, igstRate: taxContext?.igstRate },
  })

  // Legacy CGST/SGST columns, derived from the component list so existing GST
  // invoices stay byte-identical (0 for IGST/VAT/sales-tax breakdowns).
  const cgstAmount = taxResult.components.find((c) => c.code === 'CGST')?.amount ?? 0
  const sgstAmount = taxResult.components.find((c) => c.code === 'SGST')?.amount ?? 0
  const totalTax = taxResult.totalTax

  const totalAmount = taxableAmount + nonTaxableAmount + totalTax

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    taxableAmount: Math.round(taxableAmount * 100) / 100,
    nonTaxableAmount: Math.round(nonTaxableAmount * 100) / 100,
    cgstAmount,
    sgstAmount,
    totalTax,
    totalAmount: Math.round(totalAmount * 100) / 100,
    taxComponents: taxResult.components,
    taxAmount: taxResult.totalTax,
  }
}

// Invoices always show both decimal places, unlike the summary figures
// elsewhere in the app.
export function formatCurrency(
  amount: number | string | null | undefined,
  locale?: string
): string {
  return baseFormatCurrency(amount, {
    locale,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// Format date for display
export function formatDate(date: Date | string | null | undefined, locale?: string): string {
  return baseFormatDate(date, { locale })
}

// Format date-time for display
export function formatDateTime(date: Date | string | null | undefined, locale?: string): string {
  return baseFormatDateTime(date, { locale, hour12: true })
}

// Generate Invoice Number
export async function generateInvoiceNo(prisma: any, prefix: string = 'INV'): Promise<string> {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const datePrefix = `${prefix}-${year}${month}-`

  const lastInvoice = await prisma.invoice.findFirst({
    where: {
      invoiceNo: {
        startsWith: datePrefix,
      },
    },
    orderBy: {
      invoiceNo: 'desc',
    },
    select: {
      invoiceNo: true,
    },
  })

  if (lastInvoice) {
    const lastNumber = parseInt(lastInvoice.invoiceNo.slice(-4))
    return `${datePrefix}${String(lastNumber + 1).padStart(4, '0')}`
  }

  return `${datePrefix}0001`
}

// Generate Payment Number
export async function generatePaymentNo(prisma: any, prefix: string = 'PAY'): Promise<string> {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const datePrefix = `${prefix}-${year}${month}-`

  const lastPayment = await prisma.payment.findFirst({
    where: {
      paymentNo: {
        startsWith: datePrefix,
      },
    },
    orderBy: {
      paymentNo: 'desc',
    },
    select: {
      paymentNo: true,
    },
  })

  if (lastPayment) {
    const lastNumber = parseInt(lastPayment.paymentNo.slice(-4))
    return `${datePrefix}${String(lastNumber + 1).padStart(4, '0')}`
  }

  return `${datePrefix}0001`
}

// Generate Insurance Claim Number
export async function generateClaimNo(prisma: any, prefix: string = 'CLM'): Promise<string> {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const datePrefix = `${prefix}-${year}${month}-`

  const lastClaim = await prisma.insuranceClaim.findFirst({
    where: {
      claimNumber: {
        startsWith: datePrefix,
      },
    },
    orderBy: {
      claimNumber: 'desc',
    },
    select: {
      claimNumber: true,
    },
  })

  if (lastClaim) {
    const lastNumber = parseInt(lastClaim.claimNumber.slice(-4))
    return `${datePrefix}${String(lastNumber + 1).padStart(4, '0')}`
  }

  return `${datePrefix}0001`
}

// Get patient display name
export function getPatientName(
  patient: {
    firstName: string
    lastName: string
    patientId?: string
  } | null
): string {
  if (!patient) return 'Unknown Patient'
  return `${patient.firstName} ${patient.lastName}`
}

// Calculate balance amount
export function calculateBalance(totalAmount: number, paidAmount: number): number {
  return Math.round((totalAmount - paidAmount) * 100) / 100
}

// Check if invoice is overdue
export function isInvoiceOverdue(dueDate: Date | string | null, status: InvoiceStatus): boolean {
  if (!dueDate) return false
  if (status === 'PAID' || status === 'CANCELLED' || status === 'REFUNDED') {
    return false
  }

  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)

  return due < today
}

// Get days until due / days overdue
export function getDueDays(dueDate: Date | string | null): {
  days: number
  isOverdue: boolean
  label: string
} {
  if (!dueDate) return { days: 0, isOverdue: false, label: 'No due date' }

  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)

  const diffTime = due.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return {
      days: Math.abs(diffDays),
      isOverdue: true,
      label: `${Math.abs(diffDays)} days overdue`,
    }
  } else if (diffDays === 0) {
    return { days: 0, isOverdue: false, label: 'Due today' }
  } else {
    return {
      days: diffDays,
      isOverdue: false,
      label: `Due in ${diffDays} days`,
    }
  }
}

// Payment method icons mapping for Lucide icons
export const paymentMethodIcons = {
  CASH: 'Banknote',
  CARD: 'CreditCard',
  UPI: 'Smartphone',
  BANK_TRANSFER: 'Building2',
  CHEQUE: 'FileText',
  INSURANCE: 'Shield',
  WALLET: 'Wallet',
  ONLINE: 'Globe',
} as const

// Common payment terms
export const paymentTermsOptions = [
  { value: 0, label: 'Due on Receipt' },
  { value: 7, label: 'Net 7 Days' },
  { value: 15, label: 'Net 15 Days' },
  { value: 30, label: 'Net 30 Days' },
  { value: 45, label: 'Net 45 Days' },
  { value: 60, label: 'Net 60 Days' },
]

// Calculate due date from invoice date
export function calculateDueDate(invoiceDate: Date, paymentTermDays: number): Date {
  const dueDate = new Date(invoiceDate)
  dueDate.setDate(dueDate.getDate() + paymentTermDays)
  return dueDate
}

// Major/minor currency unit names for the amount-in-words line. Falls back to
// the ISO code as the major unit and generic "Cents" for the minor.
const CURRENCY_WORDS: Record<string, { major: string; minor: string }> = {
  INR: { major: 'Rupees', minor: 'Paise' },
  USD: { major: 'Dollars', minor: 'Cents' },
  EUR: { major: 'Euros', minor: 'Cents' },
  GBP: { major: 'Pounds', minor: 'Pence' },
  AED: { major: 'Dirhams', minor: 'Fils' },
  SGD: { major: 'Dollars', minor: 'Cents' },
  AUD: { major: 'Dollars', minor: 'Cents' },
  CAD: { major: 'Dollars', minor: 'Cents' },
  JPY: { major: 'Yen', minor: 'Sen' },
}

/**
 * Amount in words for an invoice, e.g. "One Thousand One Hundred Eighty Rupees
 * Only". The numbering system follows the currency — INR uses the Indian
 * Lakh/Crore grouping, every other currency uses short-scale
 * (Thousand/Million/Billion/Trillion) — and the unit names follow the currency.
 * With no options it defaults to INR, so existing invoices are unchanged.
 */
export function numberToWords(
  num: number,
  options: { currency?: string; locale?: string } = {}
): string {
  const currency = (options.currency ?? getLocaleDefaults(options.locale).currency).toUpperCase()
  const units = CURRENCY_WORDS[currency] ?? { major: currency, minor: 'Cents' }
  const useIndianSystem = currency === 'INR'

  if (num === 0) return 'Zero'

  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ]

  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ]

  function convertGroup(n: number): string {
    if (n === 0) return ''
    if (n < 20) return ones[n]
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertGroup(n % 100) : '')
  }

  // Indian system: Crore/Lakh/Thousand (…,##,##,###). Preserves the original
  // output exactly for INR.
  function toWordsIndian(whole: number): string {
    let out = ''
    if (whole >= 10000000) {
      out += convertGroup(Math.floor(whole / 10000000)) + ' Crore '
    }
    const afterCrore = whole % 10000000
    if (afterCrore >= 100000) {
      out += convertGroup(Math.floor(afterCrore / 100000)) + ' Lakh '
    }
    const afterLakh = afterCrore % 100000
    if (afterLakh >= 1000) {
      out += convertGroup(Math.floor(afterLakh / 1000)) + ' Thousand '
    }
    const afterThousand = afterLakh % 1000
    if (afterThousand > 0) {
      out += convertGroup(afterThousand)
    }
    return out.trim()
  }

  // Short scale: Thousand/Million/Billion/Trillion (groups of three).
  function toWordsShort(whole: number): string {
    if (whole === 0) return ''
    const scales = ['', 'Thousand', 'Million', 'Billion', 'Trillion', 'Quadrillion']
    const groups: number[] = []
    let n = whole
    while (n > 0) {
      groups.push(n % 1000)
      n = Math.floor(n / 1000)
    }
    const parts: string[] = []
    for (let g = groups.length - 1; g >= 0; g--) {
      if (groups[g] > 0) {
        parts.push(convertGroup(groups[g]) + (scales[g] ? ' ' + scales[g] : ''))
      }
    }
    return parts.join(' ')
  }

  const whole = Math.floor(num)
  const fraction = Math.round((num - whole) * 100)

  let result = useIndianSystem ? toWordsIndian(whole) : toWordsShort(whole)
  result = result.trim() + ' ' + units.major

  if (fraction > 0) {
    result += ' and ' + convertGroup(fraction) + ' ' + units.minor
  }

  result += ' Only'

  return result.replace(/\s+/g, ' ').trim()
}

// Report date range presets
export const dateRangePresets = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Week', value: 'this_week' },
  { label: 'Last Week', value: 'last_week' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Last Month', value: 'last_month' },
  { label: 'This Quarter', value: 'this_quarter' },
  { label: 'Last Quarter', value: 'last_quarter' },
  { label: 'This Year', value: 'this_year' },
  { label: 'Last Year', value: 'last_year' },
  { label: 'Custom Range', value: 'custom' },
]

// Get date range from preset
export function getDateRangeFromPreset(preset: string): {
  startDate: Date
  endDate: Date
} {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const endOfDay = new Date(today)
  endOfDay.setHours(23, 59, 59, 999)

  switch (preset) {
    case 'today':
      return { startDate: today, endDate: endOfDay }

    case 'yesterday': {
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const endYesterday = new Date(yesterday)
      endYesterday.setHours(23, 59, 59, 999)
      return { startDate: yesterday, endDate: endYesterday }
    }

    case 'this_week': {
      const startOfWeek = new Date(today)
      startOfWeek.setDate(today.getDate() - today.getDay())
      return { startDate: startOfWeek, endDate: endOfDay }
    }

    case 'last_week': {
      const startOfLastWeek = new Date(today)
      startOfLastWeek.setDate(today.getDate() - today.getDay() - 7)
      const endOfLastWeek = new Date(startOfLastWeek)
      endOfLastWeek.setDate(startOfLastWeek.getDate() + 6)
      endOfLastWeek.setHours(23, 59, 59, 999)
      return { startDate: startOfLastWeek, endDate: endOfLastWeek }
    }

    case 'this_month': {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      return { startDate: startOfMonth, endDate: endOfDay }
    }

    case 'last_month': {
      const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0)
      endOfLastMonth.setHours(23, 59, 59, 999)
      return { startDate: startOfLastMonth, endDate: endOfLastMonth }
    }

    case 'this_quarter': {
      const quarter = Math.floor(today.getMonth() / 3)
      const startOfQuarter = new Date(today.getFullYear(), quarter * 3, 1)
      return { startDate: startOfQuarter, endDate: endOfDay }
    }

    case 'last_quarter': {
      const currentQuarter = Math.floor(today.getMonth() / 3)
      const lastQuarter = currentQuarter - 1
      const year = lastQuarter < 0 ? today.getFullYear() - 1 : today.getFullYear()
      const actualQuarter = lastQuarter < 0 ? 3 : lastQuarter
      const startOfLastQuarter = new Date(year, actualQuarter * 3, 1)
      const endOfLastQuarter = new Date(year, (actualQuarter + 1) * 3, 0)
      endOfLastQuarter.setHours(23, 59, 59, 999)
      return { startDate: startOfLastQuarter, endDate: endOfLastQuarter }
    }

    case 'this_year': {
      const startOfYear = new Date(today.getFullYear(), 0, 1)
      return { startDate: startOfYear, endDate: endOfDay }
    }

    case 'last_year': {
      const startOfLastYear = new Date(today.getFullYear() - 1, 0, 1)
      const endOfLastYear = new Date(today.getFullYear() - 1, 11, 31)
      endOfLastYear.setHours(23, 59, 59, 999)
      return { startDate: startOfLastYear, endDate: endOfLastYear }
    }

    default:
      return { startDate: today, endDate: endOfDay }
  }
}
