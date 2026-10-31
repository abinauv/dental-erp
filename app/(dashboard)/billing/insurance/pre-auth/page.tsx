'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileCheck,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  IndianRupee,
} from 'lucide-react'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'

interface PreAuth {
  id: string
  authNumber: string | null
  requestDate: string
  procedures: Array<{ name: string; code?: string; cost?: number }>
  estimatedCost: string | number
  status: string
  approvedAmount: string | number | null
  approvedDate: string | null
  expiryDate: string | null
  denialReason: string | null
  notes: string | null
  patient: {
    id: string
    patientId: string
    firstName: string
    lastName: string
  }
  policy: {
    id: string
    policyNumber: string
    provider: { id: string; name: string }
  }
}

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }
> = {
  PENDING: { label: 'Pending', variant: 'outline', icon: Clock },
  SUBMITTED: { label: 'Submitted', variant: 'secondary', icon: FileCheck },
  APPROVED: { label: 'Approved', variant: 'default', icon: CheckCircle },
  DENIED: { label: 'Denied', variant: 'destructive', icon: XCircle },
  EXPIRED: { label: 'Expired', variant: 'secondary', icon: AlertTriangle },
}

export default function PreAuthorizationsPage() {
  const { toast } = useToast()
  const t = useTranslations('billing.preAuth')
  const tStatus = useTranslations('billing.preAuthStatus')
  const tCommon = useTranslations('common')
  const { formatDate, formatCurrency: fc } = useClinicFormatters()
  const formatCurrency = (amount: Parameters<typeof fc>[0]) =>
    fc(amount, { minimumFractionDigits: 2 })
  const [preAuths, setPreAuths] = useState<PreAuth[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [viewItem, setViewItem] = useState<PreAuth | null>(null)
  const [updating, setUpdating] = useState(false)

  const fetchPreAuths = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' })
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/pre-authorizations?${params}`)
      if (res.ok) {
        const data = await res.json()
        setPreAuths(data.preAuths)
        setTotalPages(data.pagination.totalPages)
        setTotal(data.pagination.total)
      }
    } catch {
      toast({ title: t('loadError'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPreAuths()
  }, [page, search, statusFilter])

  const handleUpdateStatus = async (id: string, status: string, extra?: Record<string, any>) => {
    setUpdating(true)
    try {
      const res = await fetch(`/api/pre-authorizations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...extra }),
      })
      if (res.ok) {
        toast({ title: t('statusUpdated', { status: status.toLowerCase() }) })
        setViewItem(null)
        fetchPreAuths()
      }
    } catch {
      toast({ title: t('updateError'), variant: 'destructive' })
    } finally {
      setUpdating(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || {
      label: status,
      variant: 'outline' as const,
      icon: Clock,
    }
    const Icon = config.icon
    const label = tStatus.has(status) ? tStatus(status) : config.label
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button asChild>
          <Link href="/billing/insurance/pre-auth/new">
            <Plus className="h-4 w-4 mr-2" />
            {t('new')}
          </Link>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        {Object.entries(STATUS_CONFIG).map(([key, config]) => {
          const count = preAuths.filter((p) => p.status === key).length
          return (
            <Card
              key={key}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
            >
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-sm text-muted-foreground">
                  {tStatus.has(key) ? tStatus(key) : config.label}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v === 'all' ? '' : v)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('allStatuses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allStatuses')}</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {tStatus.has(key) ? tStatus(key) : config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : preAuths.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">{t('empty')}</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('cols.authNo')}</TableHead>
                    <TableHead>{t('cols.patient')}</TableHead>
                    <TableHead>{t('cols.provider')}</TableHead>
                    <TableHead>{t('cols.procedures')}</TableHead>
                    <TableHead className="text-right">{t('cols.estCost')}</TableHead>
                    <TableHead className="text-right">{t('cols.approved')}</TableHead>
                    <TableHead>{t('cols.status')}</TableHead>
                    <TableHead>{t('cols.date')}</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preAuths.map((pa) => (
                    <TableRow key={pa.id}>
                      <TableCell className="font-mono text-sm">{pa.authNumber || '—'}</TableCell>
                      <TableCell>
                        <Link
                          href={`/patients/${pa.patient.id}`}
                          className="text-primary hover:underline"
                        >
                          {pa.patient.firstName} {pa.patient.lastName}
                        </Link>
                        <div className="text-xs text-muted-foreground">{pa.patient.patientId}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{pa.policy.provider.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {pa.policy.policyNumber}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate text-sm">
                          {(pa.procedures as any[]).map((p: any) => p.name).join(', ')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(pa.estimatedCost))}
                      </TableCell>
                      <TableCell className="text-right">
                        {pa.approvedAmount ? formatCurrency(Number(pa.approvedAmount)) : '—'}
                      </TableCell>
                      <TableCell>{getStatusBadge(pa.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(pa.requestDate)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => setViewItem(pa)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  {t('showing', {
                    from: (page - 1) * 10 + 1,
                    to: Math.min(page * 10, total),
                    total,
                  })}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    {tCommon('pagination.page', { page, totalPages })}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* View / Update Dialog */}
      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('detailsTitle')}</DialogTitle>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('authNumber')}</p>
                  <p className="font-medium">{viewItem.authNumber || t('notAssigned')}</p>
                </div>
                {getStatusBadge(viewItem.status)}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">{t('patient')}</p>
                  <p className="font-medium">
                    {viewItem.patient.firstName} {viewItem.patient.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('provider')}</p>
                  <p className="font-medium">{viewItem.policy.provider.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('policy')}</p>
                  <p className="font-medium">{viewItem.policy.policyNumber}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('estimatedCost')}</p>
                  <p className="font-medium">{formatCurrency(Number(viewItem.estimatedCost))}</p>
                </div>
                {viewItem.approvedAmount && (
                  <div>
                    <p className="text-muted-foreground">{t('approvedAmount')}</p>
                    <p className="font-medium text-green-600">
                      {formatCurrency(Number(viewItem.approvedAmount))}
                    </p>
                  </div>
                )}
                {viewItem.expiryDate && (
                  <div>
                    <p className="text-muted-foreground">{t('expires')}</p>
                    <p className="font-medium">{formatDate(viewItem.expiryDate)}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">{t('procedures')}</p>
                <div className="space-y-1">
                  {(viewItem.procedures as any[]).map((proc: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm bg-muted/50 rounded px-3 py-2"
                    >
                      <span>
                        {proc.name}{' '}
                        {proc.code && <span className="text-muted-foreground">({proc.code})</span>}
                      </span>
                      {proc.cost && (
                        <span className="font-medium">{formatCurrency(proc.cost)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {viewItem.denialReason && (
                <div>
                  <p className="text-sm text-muted-foreground">{t('denialReason')}</p>
                  <p className="text-sm text-destructive">{viewItem.denialReason}</p>
                </div>
              )}

              {viewItem.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">{t('notes')}</p>
                  <p className="text-sm">{viewItem.notes}</p>
                </div>
              )}

              {/* Actions based on status */}
              {(viewItem.status === 'PENDING' || viewItem.status === 'SUBMITTED') && (
                <div className="flex gap-2 pt-2 border-t">
                  {viewItem.status === 'PENDING' && (
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(viewItem.id, 'SUBMITTED')}
                      disabled={updating}
                    >
                      <FileCheck className="h-4 w-4 mr-1" /> {t('markSubmitted')}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="default"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      const amount = prompt(t('approvedPrompt'))
                      if (amount) {
                        handleUpdateStatus(viewItem.id, 'APPROVED', {
                          approvedAmount: amount,
                          approvedDate: new Date().toISOString(),
                        })
                      }
                    }}
                    disabled={updating}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" /> {t('approve')}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      const reason = prompt(t('denialPrompt'))
                      if (reason) {
                        handleUpdateStatus(viewItem.id, 'DENIED', { denialReason: reason })
                      }
                    }}
                    disabled={updating}
                  >
                    <XCircle className="h-4 w-4 mr-1" /> {t('deny')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
