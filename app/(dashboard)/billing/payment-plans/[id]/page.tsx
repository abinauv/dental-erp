'use client'

import { useState, useEffect, use } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  IndianRupee,
  CalendarClock,
  Ban,
  CreditCard,
} from 'lucide-react'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'

interface Schedule {
  id: string
  installmentNo: number
  amount: number
  dueDate: string
  paidDate: string | null
  paidAmount: number | null
  paymentId: string | null
  status: string
  payment: {
    id: string
    paymentNo: string
    amount: number
    paymentMethod: string
    paymentDate: string
    status: string
  } | null
}

interface PlanDetail {
  id: string
  hospitalId: string
  invoiceId: string
  totalAmount: number
  downPayment: number
  installments: number
  frequency: string
  interestRate: number
  status: string
  startDate: string
  nextDueDate: string | null
  notes: string | null
  createdAt: string
  patient: {
    id: string
    patientId: string
    firstName: string
    lastName: string
    phone: string
    email: string | null
  }
  invoice: {
    id: string
    invoiceNo: string
    totalAmount: number
    paidAmount: number
    balanceAmount: number
    status: string
  }
  schedules: Schedule[]
  paidInstallments: number
  overdueInstallments: number
  totalPaid: number
  totalRemaining: number
}

export default function PaymentPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const { confirm, ConfirmDialogComponent } = useConfirmDialog()
  const t = useTranslations('billing.planDetail')
  const tPlanStatus = useTranslations('billing.planStatus')
  const tInstStatus = useTranslations('billing.installmentStatus')
  const tFreq = useTranslations('billing.frequency')
  const tMethods = useTranslations('billing.paymentMethods')
  const tCommon = useTranslations('common')
  const { formatDate, formatCurrency: fc } = useClinicFormatters()
  const formatCurrency = (amount: Parameters<typeof fc>[0]) =>
    fc(amount, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  const [plan, setPlan] = useState<PlanDetail | null>(null)
  const [loading, setLoading] = useState(true)

  // Pay dialog
  const [payDialog, setPayDialog] = useState(false)
  const [payScheduleId, setPayScheduleId] = useState('')
  const [payAmount, setPayAmount] = useState(0)
  const [payMethod, setPayMethod] = useState('CASH')
  const [payTransactionId, setPayTransactionId] = useState('')
  const [paying, setPaying] = useState(false)

  // Cancel dialog
  const [cancelDialog, setCancelDialog] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    fetchPlan()
  }, [id])

  const fetchPlan = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/payment-plans/${id}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setPlan(data)
    } catch {
      toast({ variant: 'destructive', title: t('loadError') })
    } finally {
      setLoading(false)
    }
  }

  const handlePay = async () => {
    try {
      setPaying(true)
      const res = await fetch(`/api/payment-plans/${id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: payScheduleId,
          amount: payAmount,
          paymentMethod: payMethod,
          transactionId: payTransactionId || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: data.message })
      setPayDialog(false)
      fetchPlan()
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('paymentFailed'), description: err.message })
    } finally {
      setPaying(false)
    }
  }

  const handleCancel = async () => {
    try {
      setCancelling(true)
      const res = await fetch(`/api/payment-plans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: t('cancelled') })
      setCancelDialog(false)
      fetchPlan()
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('errorTitle'), description: err.message })
    } finally {
      setCancelling(false)
    }
  }

  const handleWaive = async (scheduleId: string) => {
    const ok = await confirm({
      title: t('waiveTitle'),
      description: t('waiveDesc'),
      confirmLabel: t('waiveConfirm'),
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/payment-plans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'waive', scheduleId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: t('waived') })
      fetchPlan()
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('errorTitle'), description: err.message })
    }
  }

  const openPayDialog = (schedule: Schedule) => {
    setPayScheduleId(schedule.id)
    setPayAmount(schedule.amount)
    setPayMethod('CASH')
    setPayTransactionId('')
    setPayDialog(true)
  }

  const statusBadge = (status: string) => {
    const label = tPlanStatus.has(status) ? tPlanStatus(status) : status
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{label}</Badge>
      case 'COMPLETED':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{label}</Badge>
      case 'DEFAULTED':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{label}</Badge>
      case 'CANCELLED':
        return <Badge variant="secondary">{label}</Badge>
      default:
        return <Badge variant="outline">{label}</Badge>
    }
  }

  const installmentStatusIcon = (status: string) => {
    switch (status) {
      case 'PAID':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-600" />
      case 'OVERDUE':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case 'WAIVED':
        return <XCircle className="h-4 w-4 text-muted-foreground" />
      default:
        return null
    }
  }

  const installmentBadge = (status: string) => {
    const label = tInstStatus.has(status) ? tInstStatus(status) : status
    switch (status) {
      case 'PAID':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{label}</Badge>
      case 'PENDING':
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">{label}</Badge>
      case 'OVERDUE':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{label}</Badge>
      case 'WAIVED':
        return <Badge variant="secondary">{label}</Badge>
      default:
        return <Badge variant="outline">{label}</Badge>
    }
  }

  const frequencyLabel = (freq: string) => (tFreq.has(freq) ? tFreq(freq) : freq)

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t('notFound')}</p>
        <Link href="/billing/payment-plans">
          <Button variant="outline" className="mt-4">
            {t('backToPlans')}
          </Button>
        </Link>
      </div>
    )
  }

  const progressPercent = (plan.paidInstallments / plan.installments) * 100

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/billing/payment-plans">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
              {statusBadge(plan.status)}
            </div>
            <p className="text-muted-foreground">
              {plan.patient.firstName} {plan.patient.lastName} — {t('invoiceLabel')}{' '}
              <Link
                href={`/billing/invoices/${plan.invoice.id}`}
                className="text-blue-600 hover:underline"
              >
                {plan.invoice.invoiceNo}
              </Link>
            </p>
          </div>
        </div>
        {plan.status === 'ACTIVE' && (
          <Button
            variant="outline"
            className="text-destructive"
            onClick={() => setCancelDialog(true)}
          >
            <Ban className="h-4 w-4 mr-2" />
            {t('cancelPlan')}
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalAmount')}</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(plan.totalAmount)}</div>
            {plan.interestRate > 0 && (
              <p className="text-xs text-muted-foreground">
                {t('includesInterest', { rate: Number(plan.interestRate) })}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalPaid')}</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(plan.totalPaid)}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('installmentsOf', { paid: plan.paidInstallments, total: plan.installments })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('remaining')}</CardTitle>
            <CalendarClock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(plan.totalRemaining)}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('remainingCount', {
                count:
                  plan.installments -
                  plan.paidInstallments -
                  plan.schedules.filter((s) => s.status === 'WAIVED').length,
              })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('nextDue')}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {plan.nextDueDate ? formatDate(plan.nextDueDate, { year: undefined }) : '—'}
            </div>
            {plan.overdueInstallments > 0 && (
              <p className="text-xs text-red-600">
                {t('overdue', { count: plan.overdueInstallments })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{t('paymentProgress')}</span>
            <span className="text-sm text-muted-foreground">{Math.round(progressPercent)}%</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                plan.overdueInstallments > 0 ? 'bg-red-500' : 'bg-green-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>
              {plan.downPayment > 0 &&
                t('downPaymentLabel', { amount: formatCurrency(plan.downPayment) })}
            </span>
            <span>
              {t('startedOn', {
                frequency: frequencyLabel(plan.frequency),
                date: formatDate(plan.startDate),
              })}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Plan Details */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Patient Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('patientDetails')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('name')}</span>
              <span className="font-medium">
                {plan.patient.firstName} {plan.patient.lastName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('patientId')}</span>
              <span>{plan.patient.patientId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('phone')}</span>
              <span>{plan.patient.phone}</span>
            </div>
            {plan.patient.email && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('email')}</span>
                <span>{plan.patient.email}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoice Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('invoiceDetails')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('invoiceNo')}</span>
              <Link
                href={`/billing/invoices/${plan.invoice.id}`}
                className="text-blue-600 hover:underline font-medium"
              >
                {plan.invoice.invoiceNo}
              </Link>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('invoiceTotal')}</span>
              <span className="font-medium">{formatCurrency(plan.invoice.totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('totalPaid')}</span>
              <span className="text-green-600">{formatCurrency(plan.invoice.paidAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('balance')}</span>
              <span className="text-red-600">{formatCurrency(plan.invoice.balanceAmount)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Plan Terms */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('planTerms')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('frequency')}</span>
              <span>{frequencyLabel(plan.frequency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('installments')}</span>
              <span>{plan.installments}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('interestRate')}</span>
              <span>{Number(plan.interestRate)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('downPayment')}</span>
              <span>{formatCurrency(plan.downPayment)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('created')}</span>
              <span>{formatDate(plan.createdAt)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      {plan.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('notes')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{plan.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Installment Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>{t('schedule')}</CardTitle>
          <CardDescription>{t('scheduleDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">#</TableHead>
                <TableHead>{t('cols.dueDate')}</TableHead>
                <TableHead>{t('cols.amount')}</TableHead>
                <TableHead>{t('cols.status')}</TableHead>
                <TableHead>{t('cols.paidDate')}</TableHead>
                <TableHead>{t('cols.paidAmount')}</TableHead>
                <TableHead>{t('cols.paymentMethod')}</TableHead>
                <TableHead className="w-[140px]">{t('cols.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.schedules.map((schedule) => (
                <TableRow
                  key={schedule.id}
                  className={
                    schedule.status === 'OVERDUE'
                      ? 'bg-red-50'
                      : schedule.status === 'PAID'
                        ? 'bg-green-50/50'
                        : ''
                  }
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {installmentStatusIcon(schedule.status)}
                      <span className="font-medium">{schedule.installmentNo}</span>
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(schedule.dueDate)}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(schedule.amount)}</TableCell>
                  <TableCell>{installmentBadge(schedule.status)}</TableCell>
                  <TableCell>{schedule.paidDate ? formatDate(schedule.paidDate) : '—'}</TableCell>
                  <TableCell>
                    {schedule.paidAmount ? formatCurrency(schedule.paidAmount) : '—'}
                  </TableCell>
                  <TableCell>
                    {schedule.payment?.paymentMethod
                      ? tMethods.has(schedule.payment.paymentMethod)
                        ? tMethods(schedule.payment.paymentMethod)
                        : schedule.payment.paymentMethod
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {(schedule.status === 'PENDING' || schedule.status === 'OVERDUE') &&
                      plan.status === 'ACTIVE' && (
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => openPayDialog(schedule)}>
                            <CreditCard className="h-3 w-3 mr-1" />
                            {t('pay')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleWaive(schedule.id)}
                          >
                            {t('waive')}
                          </Button>
                        </div>
                      )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pay Dialog */}
      <Dialog open={payDialog} onOpenChange={setPayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('recordPaymentTitle')}</DialogTitle>
            <DialogDescription>{t('recordPaymentDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('amount')}</Label>
              <Input
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                min={1}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('paymentMethod')}</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">{tMethods('CASH')}</SelectItem>
                  <SelectItem value="CARD">{tMethods('CARD')}</SelectItem>
                  <SelectItem value="UPI">{tMethods('UPI')}</SelectItem>
                  <SelectItem value="BANK_TRANSFER">{tMethods('BANK_TRANSFER')}</SelectItem>
                  <SelectItem value="CHEQUE">{tMethods('CHEQUE')}</SelectItem>
                  <SelectItem value="ONLINE">{tMethods('ONLINE')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('transactionId')}</Label>
              <Input
                placeholder={t('transactionPlaceholder')}
                value={payTransactionId}
                onChange={(e) => setPayTransactionId(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(false)}>
              {tCommon('actions.cancel')}
            </Button>
            <Button onClick={handlePay} disabled={paying || payAmount <= 0}>
              {paying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('processing')}
                </>
              ) : (
                t('recordPaymentBtn', { amount: formatCurrency(payAmount) })
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialog} onOpenChange={setCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('cancelPlanTitle')}</DialogTitle>
            <DialogDescription>{t('cancelPlanDesc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialog(false)}>
              {t('keepPlan')}
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('cancelling')}
                </>
              ) : (
                t('cancelPlan')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {ConfirmDialogComponent}
    </div>
  )
}
