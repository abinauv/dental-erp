'use client'

import { useState, useEffect, use } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Printer,
  CreditCard,
  FileText,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  IndianRupee,
  Banknote,
  Smartphone,
  Building2,
  Share2,
  Copy,
  Check,
  Loader2,
} from 'lucide-react'
import {
  invoiceStatusConfig,
  paymentMethodConfig,
  paymentStatusConfig,
  getDueDays,
  numberToWords,
} from '@/lib/billing-utils'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'
import { PaymentCheckout } from '@/components/billing/payment-checkout'

interface Invoice {
  id: string
  invoiceNo: string
  invoiceDate: string
  dueDate: string | null
  subtotal: string | number
  discountType: string
  discountValue: string | number
  discountAmount: string | number
  taxableAmount: string | number
  cgstRate: string | number
  cgstAmount: string | number
  sgstRate: string | number
  sgstAmount: string | number
  totalAmount: string | number
  paidAmount: string | number
  balanceAmount: string | number
  status: string
  notes: string | null
  termsAndConditions: string | null
  patient: {
    id: string
    patientId: string
    firstName: string
    lastName: string
    phone: string
    email: string | null
    address: string | null
    city: string | null
    state: string | null
    pincode: string | null
  }
  items: Array<{
    id: string
    description: string
    quantity: number
    unitPrice: string | number
    amount: string | number
    taxable: boolean
    treatment: {
      id: string
      treatmentNo: string
      toothNumbers: string | null
      procedure: {
        id: string
        name: string
        code: string
        category: string
      }
      doctor: {
        id: string
        firstName: string
        lastName: string
      }
    } | null
  }>
  payments: Array<{
    id: string
    paymentNo: string
    amount: string | number
    paymentMethod: string
    paymentDate: string
    status: string
    transactionId: string | null
    notes: string | null
    refundAmount: string | number | null
    refundDate: string | null
  }>
  insuranceClaim: {
    id: string
    claimNumber: string
    status: string
    approvedAmount: string | number | null
  } | null
}

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const showPaymentDialog = searchParams.get('action') === 'payment'

  const t = useTranslations('billing.invoiceDetail')
  const tInv = useTranslations('billing.invoice')
  const tStatus = useTranslations('billing.status')
  const tMethods = useTranslations('billing.paymentMethods')
  const tCommon = useTranslations('common')
  const { formatDate, formatCurrency: fc } = useClinicFormatters()
  const formatCurrency = (amount: Parameters<typeof fc>[0]) =>
    fc(amount, { minimumFractionDigits: 2 })

  const [loading, setLoading] = useState(true)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [error, setError] = useState('')

  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(showPaymentDialog)
  const [paymentSubmitting, setPaymentSubmitting] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [transactionId, setTransactionId] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')

  // Payment link state
  const [linkLoading, setLinkLoading] = useState(false)
  const [paymentLink, setPaymentLink] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)

  const fetchInvoice = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/invoices/${id}`)
      if (!response.ok) throw new Error('Failed to fetch invoice')
      const data = await response.json()
      setInvoice(data)
      // Set default payment amount to balance
      setPaymentAmount(String(Number(data.balanceAmount)))
    } catch (error) {
      console.error('Error fetching invoice:', error)
      setError(t('errLoad'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoice()
  }, [id])

  const handleRecordPayment = async () => {
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      setError(t('errAmount'))
      return
    }
    if (!paymentMethod) {
      setError(t('errMethod'))
      return
    }

    try {
      setPaymentSubmitting(true)
      setError('')

      const response = await fetch(`/api/invoices/${id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(paymentAmount),
          paymentMethod,
          paymentDate,
          transactionId: transactionId || undefined,
          notes: paymentNotes || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to record payment')
      }

      setPaymentDialogOpen(false)
      fetchInvoice()

      // Reset form
      setPaymentAmount('')
      setPaymentMethod('')
      setTransactionId('')
      setPaymentNotes('')
    } catch (error: any) {
      setError(error.message)
    } finally {
      setPaymentSubmitting(false)
    }
  }

  const handleSharePaymentLink = async () => {
    try {
      setLinkLoading(true)
      const res = await fetch('/api/payments/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: id }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to generate link')
      }
      const data = await res.json()
      setPaymentLink(data.link.url)
      await navigator.clipboard.writeText(data.link.url)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLinkLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const config = invoiceStatusConfig[status as keyof typeof invoiceStatusConfig] || {
      label: status,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
    }
    const label = tStatus.has(status) ? tStatus(status) : config.label
    return <Badge className={`${config.bgColor} ${config.color} border-0`}>{label}</Badge>
  }

  const getPaymentStatusBadge = (status: string) => {
    const config = paymentStatusConfig[status as keyof typeof paymentStatusConfig] || {
      label: status,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
    }
    return <Badge className={`${config.bgColor} ${config.color} border-0`}>{config.label}</Badge>
  }

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'CASH':
        return <Banknote className="h-4 w-4" />
      case 'CARD':
        return <CreditCard className="h-4 w-4" />
      case 'UPI':
        return <Smartphone className="h-4 w-4" />
      case 'BANK_TRANSFER':
        return <Building2 className="h-4 w-4" />
      default:
        return <CreditCard className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-96" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg text-muted-foreground">{t('notFound')}</p>
        <Link href="/billing/invoices">
          <Button variant="outline" className="mt-4">
            {t('backToInvoices')}
          </Button>
        </Link>
      </div>
    )
  }

  const dueDays = getDueDays(invoice.dueDate)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/billing/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{invoice.invoiceNo}</h1>
              {getStatusBadge(invoice.status)}
            </div>
            <p className="text-muted-foreground">
              {t('createdOn', { date: formatDate(invoice.invoiceDate) })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            {t('print')}
          </Button>
          {['PENDING', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status) && (
            <>
              <PaymentCheckout
                invoiceId={invoice.id}
                amount={Number(invoice.balanceAmount)}
                invoiceNo={invoice.invoiceNo}
                patientName={`${invoice.patient.firstName} ${invoice.patient.lastName}`}
                onSuccess={fetchInvoice}
              />
              <Button onClick={() => setPaymentDialogOpen(true)}>
                <CreditCard className="h-4 w-4 mr-2" />
                {t('recordPayment')}
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Patient Info */}
          <Card>
            <CardHeader>
              <CardTitle>{t('billTo')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-lg">
                    {invoice.patient.firstName} {invoice.patient.lastName}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t('patientId', { id: invoice.patient.patientId })}
                  </div>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {invoice.patient.phone}
                    </div>
                    {invoice.patient.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {invoice.patient.email}
                      </div>
                    )}
                    {invoice.patient.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {invoice.patient.address}
                        {invoice.patient.city && `, ${invoice.patient.city}`}
                        {invoice.patient.state && `, ${invoice.patient.state}`}
                        {invoice.patient.pincode && ` - ${invoice.patient.pincode}`}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Items */}
          <Card>
            <CardHeader>
              <CardTitle>{t('items')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50%]">{t('cols.description')}</TableHead>
                    <TableHead className="text-center">{t('cols.qty')}</TableHead>
                    <TableHead className="text-right">{t('cols.unitPrice')}</TableHead>
                    <TableHead className="text-right">{t('cols.amount')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium">{item.description}</div>
                        {item.treatment && (
                          <div className="text-sm text-muted-foreground">
                            {item.treatment.treatmentNo}
                            {item.treatment.doctor && (
                              <>
                                {' '}
                                • Dr. {item.treatment.doctor.firstName}{' '}
                                {item.treatment.doctor.lastName}
                              </>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Totals */}
              <div className="border-t p-4">
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{tInv('subtotal')}</span>
                      <span>{formatCurrency(invoice.subtotal)}</span>
                    </div>
                    {Number(invoice.discountAmount) > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>{tInv('discount')}</span>
                        <span>-{formatCurrency(invoice.discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {tInv('cgst')} ({invoice.cgstRate}%)
                      </span>
                      <span>{formatCurrency(invoice.cgstAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {tInv('sgst')} ({invoice.sgstRate}%)
                      </span>
                      <span>{formatCurrency(invoice.sgstAmount)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>{tInv('total')}</span>
                      <span>{formatCurrency(invoice.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>{t('paid')}</span>
                      <span>{formatCurrency(invoice.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>{t('balanceDue')}</span>
                      <span className={Number(invoice.balanceAmount) > 0 ? 'text-red-600' : ''}>
                        {formatCurrency(invoice.balanceAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Amount in Words */}
          <Card>
            <CardContent className="py-4">
              <div className="text-sm">
                <span className="text-muted-foreground">{tInv('amountInWords')}: </span>
                <span className="font-medium">{numberToWords(Number(invoice.totalAmount))}</span>
              </div>
            </CardContent>
          </Card>

          {/* Payment History */}
          {invoice.payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('paymentHistory')}</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('payCols.payment')}</TableHead>
                      <TableHead>{t('payCols.date')}</TableHead>
                      <TableHead>{t('payCols.method')}</TableHead>
                      <TableHead className="text-right">{t('payCols.amount')}</TableHead>
                      <TableHead>{t('payCols.status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          <div className="font-medium">{payment.paymentNo}</div>
                          {payment.transactionId && (
                            <div className="text-sm text-muted-foreground">
                              {t('txn', { id: payment.transactionId })}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getPaymentMethodIcon(payment.paymentMethod)}
                            {tMethods.has(payment.paymentMethod)
                              ? tMethods(payment.paymentMethod)
                              : paymentMethodConfig[
                                  payment.paymentMethod as keyof typeof paymentMethodConfig
                                ]?.label || payment.paymentMethod}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(payment.amount)}
                        </TableCell>
                        <TableCell>{getPaymentStatusBadge(payment.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Notes & Terms */}
          {(invoice.notes || invoice.termsAndConditions) && (
            <Card>
              <CardContent className="py-4 space-y-4">
                {invoice.notes && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      {t('notes')}
                    </div>
                    <p className="text-sm">{invoice.notes}</p>
                  </div>
                )}
                {invoice.termsAndConditions && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      {t('terms')}
                    </div>
                    <p className="text-sm whitespace-pre-line">{invoice.termsAndConditions}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t('invoiceStatus')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('status')}</span>
                {getStatusBadge(invoice.status)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('invoiceDate')}</span>
                <span>{formatDate(invoice.invoiceDate)}</span>
              </div>
              {invoice.dueDate && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('dueDate')}</span>
                  <div className="text-right">
                    <div>{formatDate(invoice.dueDate)}</div>
                    {dueDays.isOverdue && invoice.status !== 'PAID' && (
                      <div className="text-xs text-red-600 flex items-center justify-end gap-1">
                        <Clock className="h-3 w-3" />
                        {dueDays.label}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('totalAmount')}</span>
                <span className="font-semibold">{formatCurrency(invoice.totalAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('amountPaid')}</span>
                <span className="text-green-600 font-semibold">
                  {formatCurrency(invoice.paidAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('balanceDue')}</span>
                <span
                  className={`font-semibold ${Number(invoice.balanceAmount) > 0 ? 'text-red-600' : ''}`}
                >
                  {formatCurrency(invoice.balanceAmount)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Insurance Claim */}
          {invoice.insuranceClaim && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {t('insuranceClaim')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('claimNumber')}</span>
                  <span className="font-medium">{invoice.insuranceClaim.claimNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('status')}</span>
                  <Badge>{invoice.insuranceClaim.status}</Badge>
                </div>
                {invoice.insuranceClaim.approvedAmount && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('approved')}</span>
                    <span className="font-medium text-green-600">
                      {formatCurrency(invoice.insuranceClaim.approvedAmount)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>{t('actionsTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {['PENDING', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status) && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleSharePaymentLink}
                  disabled={linkLoading}
                >
                  {linkLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : linkCopied ? (
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                  ) : (
                    <Share2 className="h-4 w-4 mr-2" />
                  )}
                  {linkCopied ? t('linkCopied') : t('sharePaymentLink')}
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => window.print()}
              >
                <Printer className="h-4 w-4 mr-2" />
                {t('printInvoice')}
              </Button>
              {invoice.patient.email && (
                <Button variant="outline" className="w-full justify-start">
                  <Mail className="h-4 w-4 mr-2" />
                  {t('sendEmail')}
                </Button>
              )}
              <Link href={`/patients/${invoice.patient.id}`} className="block">
                <Button variant="outline" className="w-full justify-start">
                  <User className="h-4 w-4 mr-2" />
                  {t('viewPatient')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('recordPayment')}</DialogTitle>
            <DialogDescription>
              {t('recordPaymentDesc', { invoiceNo: invoice.invoiceNo })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>{t('amount')}</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="pl-9"
                  max={Number(invoice.balanceAmount)}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {t('balanceDueAmount', { amount: formatCurrency(invoice.balanceAmount) })}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t('paymentMethod')}</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectMethod')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">{tMethods('CASH')}</SelectItem>
                  <SelectItem value="CARD">{tMethods('CARD')}</SelectItem>
                  <SelectItem value="UPI">{tMethods('UPI')}</SelectItem>
                  <SelectItem value="BANK_TRANSFER">{tMethods('BANK_TRANSFER')}</SelectItem>
                  <SelectItem value="CHEQUE">{tMethods('CHEQUE')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('paymentDate')}</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('transactionId')}</Label>
              <Input
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder={t('transactionPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('notesOptional')}</Label>
              <Textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder={t('notesPlaceholder')}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              {tCommon('actions.cancel')}
            </Button>
            <Button onClick={handleRecordPayment} disabled={paymentSubmitting}>
              {paymentSubmitting ? t('recording') : t('recordPayment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
