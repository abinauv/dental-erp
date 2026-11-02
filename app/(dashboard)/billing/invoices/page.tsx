'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
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
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  User,
  Phone,
  MoreHorizontal,
  Eye,
  Edit,
  CreditCard,
  FileText,
  Printer,
  Mail,
  Trash2,
  AlertCircle,
  Clock,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { invoiceStatusConfig, getDueDays } from '@/lib/billing-utils'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'

interface Invoice {
  id: string
  invoiceNo: string
  invoiceDate: string
  dueDate: string | null
  subtotal: string | number
  discountAmount: string | number
  totalAmount: string | number
  paidAmount: string | number
  balanceAmount: string | number
  status: string
  patient: {
    id: string
    patientId: string
    firstName: string
    lastName: string
    phone: string
    email: string | null
  }
  _count: {
    payments: number
    items: number
  }
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function InvoicesPage() {
  const router = useRouter()
  const t = useTranslations('billing.invoices')
  const tStatus = useTranslations('billing.status')
  const tCommon = useTranslations('common')
  const { formatDate, formatCurrency: fc } = useClinicFormatters()
  // Invoices always show both decimal places (unlike summary figures elsewhere).
  const formatCurrency = (amount: Parameters<typeof fc>[0]) =>
    fc(amount, { minimumFractionDigits: 2 })
  const { confirm, ConfirmDialogComponent } = useConfirmDialog()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  })

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })

      if (search) params.append('search', search)
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter)
      if (dateFrom) params.append('dateFrom', dateFrom)
      if (dateTo) params.append('dateTo', dateTo)
      if (overdueOnly) params.append('overdue', 'true')

      const response = await fetch(`/api/invoices?${params}`)
      if (!response.ok) throw new Error('Failed to fetch invoices')

      const data = await response.json()
      setInvoices(data.invoices)
      setPagination(data.pagination)
    } catch (error) {
      console.error('Error fetching invoices:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoices()
  }, [pagination.page, search, statusFilter, dateFrom, dateTo, overdueOnly])

  const getStatusBadge = (status: string) => {
    const config = invoiceStatusConfig[status as keyof typeof invoiceStatusConfig] || {
      label: status,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
    }
    const label = tStatus.has(status) ? tStatus(status) : config.label
    return <Badge className={`${config.bgColor} ${config.color} border-0`}>{label}</Badge>
  }

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: t('cancelDialog.title'),
      description: t('cancelDialog.description'),
      confirmLabel: t('cancelDialog.confirm'),
    })
    if (!ok) return

    try {
      const response = await fetch(`/api/invoices/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete invoice')
      fetchInvoices()
    } catch (error) {
      console.error('Error deleting invoice:', error)
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
        <Link href="/billing/invoices/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            {t('new')}
          </Button>
        </Link>
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
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder={t('columns.status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tStatus('all')}</SelectItem>
                  <SelectItem value="DRAFT">{tStatus('DRAFT')}</SelectItem>
                  <SelectItem value="PENDING">{tStatus('PENDING')}</SelectItem>
                  <SelectItem value="PARTIALLY_PAID">{tStatus('PARTIALLY_PAID')}</SelectItem>
                  <SelectItem value="PAID">{tStatus('PAID')}</SelectItem>
                  <SelectItem value="OVERDUE">{tStatus('OVERDUE')}</SelectItem>
                  <SelectItem value="CANCELLED">{tStatus('CANCELLED')}</SelectItem>
                  <SelectItem value="REFUNDED">{tStatus('REFUNDED')}</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[140px]"
                placeholder="From Date"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[140px]"
                placeholder="To Date"
              />
              <Button
                variant={overdueOnly ? 'default' : 'outline'}
                onClick={() => setOverdueOnly(!overdueOnly)}
                size="sm"
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                {t('overdueOnly')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.invoice')}</TableHead>
                <TableHead>{t('columns.patient')}</TableHead>
                <TableHead className="text-right">{t('columns.amount')}</TableHead>
                <TableHead className="text-right">{t('columns.paid')}</TableHead>
                <TableHead className="text-right">{t('columns.balance')}</TableHead>
                <TableHead>{t('columns.dueDate')}</TableHead>
                <TableHead>{t('columns.status')}</TableHead>
                <TableHead className="text-right">{t('columns.actions')}</TableHead>
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
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-8" />
                    </TableCell>
                  </TableRow>
                ))
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">{t('empty')}</p>
                      <Link href="/billing/invoices/new">
                        <Button variant="outline" size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          {t('createNew')}
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((invoice) => {
                  const dueDays = getDueDays(invoice.dueDate)
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <div className="font-medium">{invoice.invoiceNo}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(invoice.invoiceDate)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">
                              {invoice.patient.firstName} {invoice.patient.lastName}
                            </div>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {invoice.patient.phone}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(invoice.totalAmount)}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(invoice.paidAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            Number(invoice.balanceAmount) > 0 ? 'text-red-600 font-medium' : ''
                          }
                        >
                          {formatCurrency(invoice.balanceAmount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {invoice.dueDate ? (
                          <div className="flex flex-col">
                            <span className="text-sm">{formatDate(invoice.dueDate)}</span>
                            {dueDays.isOverdue && invoice.status !== 'PAID' && (
                              <span className="text-xs text-red-600 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {dueDays.label}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => router.push(`/billing/invoices/${invoice.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              {t('actions.view')}
                            </DropdownMenuItem>
                            {invoice.status === 'DRAFT' && (
                              <DropdownMenuItem
                                onClick={() => router.push(`/billing/invoices/${invoice.id}/edit`)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                {t('actions.edit')}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {['PENDING', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status) && (
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(`/billing/invoices/${invoice.id}?action=payment`)
                                }
                              >
                                <CreditCard className="h-4 w-4 mr-2" />
                                {t('actions.recordPayment')}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => window.print()}>
                              <Printer className="h-4 w-4 mr-2" />
                              {t('actions.print')}
                            </DropdownMenuItem>
                            {invoice.patient.email && (
                              <DropdownMenuItem>
                                <Mail className="h-4 w-4 mr-2" />
                                {t('actions.sendEmail')}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && (
                              <DropdownMenuItem
                                onClick={() => handleDelete(invoice.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t('actions.cancel')}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {!loading && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-4">
              <div className="text-sm text-muted-foreground">
                {t('pagination.showing', {
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
                  {t('pagination.page', {
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
      {ConfirmDialogComponent}
    </div>
  )
}
