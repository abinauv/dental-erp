'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  User,
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  FileText,
  MoreHorizontal,
  Eye,
  RotateCcw,
  IndianRupee,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { paymentMethodConfig, paymentStatusConfig } from '@/lib/billing-utils'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'
import { ExportMenu } from '@/components/ui/export-menu'

interface Payment {
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
  invoice: {
    id: string
    invoiceNo: string
    totalAmount: string | number
    patient: {
      id: string
      patientId: string
      firstName: string
      lastName: string
      phone: string
    }
  }
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface Summary {
  totalReceived: number
  totalRefunded: number
}

export default function PaymentsPage() {
  const router = useRouter()
  const t = useTranslations('billing.payments')
  const tPayStatus = useTranslations('billing.paymentStatus')
  const tMethods = useTranslations('billing.paymentMethods')
  const tCommon = useTranslations('common')
  const { formatDate, formatCurrency: fc } = useClinicFormatters()
  const formatCurrency = (amount: Parameters<typeof fc>[0]) =>
    fc(amount, { minimumFractionDigits: 2 })
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<Summary>({ totalReceived: 0, totalRefunded: 0 })
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  })

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [methodFilter, setMethodFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('all')
  const [dateTo, setDateTo] = useState('all')

  const fetchPayments = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })

      if (search) params.append('search', search)
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter)
      if (methodFilter && methodFilter !== 'all') params.append('paymentMethod', methodFilter)
      if (dateFrom) params.append('dateFrom', dateFrom)
      if (dateTo) params.append('dateTo', dateTo)

      const response = await fetch(`/api/payments?${params}`)
      if (!response.ok) throw new Error('Failed to fetch payments')

      const data = await response.json()
      setPayments(data.payments)
      setSummary(data.summary)
      setPagination(data.pagination)
    } catch (error) {
      console.error('Error fetching payments:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPayments()
  }, [pagination.page, search, statusFilter, methodFilter, dateFrom, dateTo])

  const getStatusBadge = (status: string) => {
    const config = paymentStatusConfig[status as keyof typeof paymentStatusConfig] || {
      label: status,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
    }
    const label = tPayStatus.has(status) ? tPayStatus(status) : config.label
    return <Badge className={`${config.bgColor} ${config.color} border-0`}>{label}</Badge>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <ExportMenu
          filename="payments"
          getData={() =>
            payments.map((p) => ({
              'Payment No': p.paymentNo,
              Patient: `${p.invoice.patient.firstName} ${p.invoice.patient.lastName}`,
              'Patient ID': p.invoice.patient.patientId,
              'Invoice No': p.invoice.invoiceNo,
              'Payment Date': formatDate(p.paymentDate),
              Method: p.paymentMethod,
              Amount: Number(p.amount),
              Status: p.status,
              'Transaction ID': p.transactionId || '',
              'Refund Amount': p.refundAmount ? Number(p.refundAmount) : '',
              Notes: p.notes || '',
            }))
          }
        />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalReceived')}</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(summary.totalReceived)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalRefunded')}</CardTitle>
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(summary.totalRefunded)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('netCollection')}</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold">
                {formatCurrency(summary.totalReceived - summary.totalRefunded)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder={t('status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tPayStatus('all')}</SelectItem>
                  <SelectItem value="PENDING">{tPayStatus('PENDING')}</SelectItem>
                  <SelectItem value="COMPLETED">{tPayStatus('COMPLETED')}</SelectItem>
                  <SelectItem value="FAILED">{tPayStatus('FAILED')}</SelectItem>
                  <SelectItem value="REFUNDED">{tPayStatus('REFUNDED')}</SelectItem>
                  <SelectItem value="CANCELLED">{tPayStatus('CANCELLED')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder={t('method')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allMethods')}</SelectItem>
                  <SelectItem value="CASH">{tMethods('CASH')}</SelectItem>
                  <SelectItem value="CARD">{tMethods('CARD')}</SelectItem>
                  <SelectItem value="UPI">{tMethods('UPI')}</SelectItem>
                  <SelectItem value="BANK_TRANSFER">{tMethods('BANK_TRANSFER')}</SelectItem>
                  <SelectItem value="CHEQUE">{tMethods('CHEQUE')}</SelectItem>
                  <SelectItem value="INSURANCE">{tMethods('INSURANCE')}</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[140px]"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[140px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t('cols.payment')}</TableHead>
                <TableHead>{t('cols.patient')}</TableHead>
                <TableHead>{t('cols.invoice')}</TableHead>
                <TableHead>{t('cols.date')}</TableHead>
                <TableHead>{t('cols.method')}</TableHead>
                <TableHead className="text-right">{t('cols.amount')}</TableHead>
                <TableHead>{t('cols.status')}</TableHead>
                <TableHead className="text-right">{t('cols.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-8" />
                    </TableCell>
                  </TableRow>
                ))
              ) : payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <CreditCard className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">{t('empty')}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div className="font-medium">{payment.paymentNo}</div>
                      {payment.transactionId && (
                        <div className="text-sm text-muted-foreground">
                          {t('txn', { id: payment.transactionId })}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {payment.invoice.patient.firstName} {payment.invoice.patient.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {payment.invoice.patient.patientId}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/billing/invoices/${payment.invoice.id}`}
                        className="text-primary hover:underline"
                      >
                        {payment.invoice.invoiceNo}
                      </Link>
                    </TableCell>
                    <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getPaymentMethodIcon(payment.paymentMethod)}
                        <span>
                          {tMethods.has(payment.paymentMethod)
                            ? tMethods(payment.paymentMethod)
                            : paymentMethodConfig[
                                payment.paymentMethod as keyof typeof paymentMethodConfig
                              ]?.label || payment.paymentMethod}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-medium">{formatCurrency(payment.amount)}</div>
                      {payment.refundAmount && Number(payment.refundAmount) > 0 && (
                        <div className="text-sm text-red-600">
                          {t('refund', { amount: formatCurrency(payment.refundAmount) })}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => router.push(`/billing/invoices/${payment.invoice.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            {t('viewInvoice')}
                          </DropdownMenuItem>
                          {payment.status === 'COMPLETED' && (
                            <DropdownMenuItem
                              onClick={() => router.push(`/billing/payments/${payment.id}/refund`)}
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              {t('processRefund')}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {!loading && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-4">
              <div className="text-sm text-muted-foreground">
                {t('showing', {
                  from: (pagination.page - 1) * pagination.limit + 1,
                  to: Math.min(pagination.page * pagination.limit, pagination.total),
                  total: pagination.total,
                })}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                  disabled={pagination.page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  {tCommon('actions.previous')}
                </Button>
                <div className="text-sm">
                  {tCommon('pagination.page', {
                    page: pagination.page,
                    totalPages: pagination.totalPages,
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  {tCommon('actions.next')}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
