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
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  User,
  Shield,
  MoreHorizontal,
  Eye,
  Edit,
  Send,
  CheckCircle,
  XCircle,
  IndianRupee,
  FileText,
  Clock,
  Building2,
  FileCheck,
  AlertTriangle,
  Gavel,
  Brain,
  Loader2,
} from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { insuranceClaimStatusConfig } from '@/lib/billing-utils'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'

interface InsuranceClaim {
  id: string
  claimNumber: string
  insuranceProvider: string
  policyNumber: string
  claimAmount: string | number
  approvedAmount: string | number | null
  settledAmount: string | number | null
  status: string
  submissionDate: string | null
  approvalDate: string | null
  settlementDate: string | null
  rejectionReason: string | null
  denialCode: string | null
  appealDeadline: string | null
  appealStatus: string | null
  appealDate: string | null
  appealNotes: string | null
  createdAt: string
  patient: {
    id: string
    patientId: string
    firstName: string
    lastName: string
    phone: string
  }
  invoices: Array<{
    id: string
    invoiceNo: string
    totalAmount: string | number
    insuranceAmount: string | number | null
  }>
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface Summary {
  totalClaimed: number
  totalApproved: number
  totalSettled: number
}

export default function InsuranceClaimsPage() {
  const router = useRouter()
  const t = useTranslations('billing.insurance')
  const tClaimStatus = useTranslations('billing.claimStatus')
  const tAppealStatus = useTranslations('billing.appealStatus')
  const tCommon = useTranslations('common')
  const { formatDate, formatCurrency: fc } = useClinicFormatters()
  const formatCurrency = (amount: Parameters<typeof fc>[0]) =>
    fc(amount, { minimumFractionDigits: 2 })
  const [claims, setClaims] = useState<InsuranceClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<Summary>({
    totalClaimed: 0,
    totalApproved: 0,
    totalSettled: 0,
  })
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

  const fetchClaims = async () => {
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

      const response = await fetch(`/api/insurance-claims?${params}`)
      if (!response.ok) throw new Error('Failed to fetch claims')

      const data = await response.json()
      setClaims(data.claims)
      setSummary(data.summary)
      setPagination(data.pagination)
    } catch (error) {
      console.error('Error fetching claims:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClaims()
  }, [pagination.page, search, statusFilter, dateFrom, dateTo])

  const getStatusBadge = (status: string) => {
    const config = insuranceClaimStatusConfig[
      status as keyof typeof insuranceClaimStatusConfig
    ] || {
      label: status,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
    }
    const label = tClaimStatus.has(status) ? tClaimStatus(status) : config.label
    return <Badge className={`${config.bgColor} ${config.color} border-0`}>{label}</Badge>
  }

  // AI Analysis
  const [aiAnalysisClaim, setAiAnalysisClaim] = useState<InsuranceClaim | null>(null)
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)
  const [aiAnalyzing, setAiAnalyzing] = useState(false)

  const handleAiAnalyze = async (claim: InsuranceClaim) => {
    setAiAnalysisClaim(claim)
    setAiAnalysis(null)
    setAiAnalyzing(true)
    try {
      const res = await fetch('/api/ai/claim-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId: claim.id }),
      })
      if (!res.ok) throw new Error('Failed')
      setAiAnalysis(await res.json())
    } catch {
      setAiAnalysis({ error: t('analyzeFailed') })
    } finally {
      setAiAnalyzing(false)
    }
  }

  const [denialClaim, setDenialClaim] = useState<InsuranceClaim | null>(null)
  const [denialForm, setDenialForm] = useState({
    denialCode: '',
    appealDeadline: '',
    appealStatus: '',
    appealNotes: '',
  })

  const handleSubmitClaim = async (id: string) => {
    try {
      const response = await fetch(`/api/insurance-claims/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SUBMITTED' }),
      })
      if (!response.ok) throw new Error('Failed to submit claim')
      fetchClaims()
    } catch (error) {
      console.error('Error submitting claim:', error)
    }
  }

  const openDenialManagement = (claim: InsuranceClaim) => {
    setDenialClaim(claim)
    setDenialForm({
      denialCode: claim.denialCode || '',
      appealDeadline: claim.appealDeadline ? claim.appealDeadline.split('T')[0] : '',
      appealStatus: claim.appealStatus || '',
      appealNotes: claim.appealNotes || '',
    })
  }

  const handleSaveDenialInfo = async () => {
    if (!denialClaim) return
    try {
      const response = await fetch(`/api/insurance-claims/${denialClaim.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          denialCode: denialForm.denialCode || null,
          appealDeadline: denialForm.appealDeadline || null,
          appealStatus: denialForm.appealStatus || null,
          appealNotes: denialForm.appealNotes || null,
          appealDate:
            denialForm.appealStatus === 'SUBMITTED' ? new Date().toISOString() : undefined,
        }),
      })
      if (!response.ok) throw new Error('Failed to update')
      setDenialClaim(null)
      fetchClaims()
    } catch (error) {
      console.error('Error updating denial info:', error)
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
        <div className="flex gap-2">
          <Link href="/billing/insurance/providers">
            <Button variant="outline">
              <Building2 className="h-4 w-4 mr-2" />
              {t('providers')}
            </Button>
          </Link>
          <Link href="/billing/insurance/pre-auth">
            <Button variant="outline">
              <FileCheck className="h-4 w-4 mr-2" />
              {t('preAuth')}
            </Button>
          </Link>
          <Link href="/billing/insurance/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t('newClaim')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalClaimed')}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(summary.totalClaimed)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalApproved')}</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(summary.totalApproved)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalSettled')}</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(summary.totalSettled)}
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
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder={t('status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tClaimStatus('all')}</SelectItem>
                  <SelectItem value="DRAFT">{tClaimStatus('DRAFT')}</SelectItem>
                  <SelectItem value="SUBMITTED">{tClaimStatus('SUBMITTED')}</SelectItem>
                  <SelectItem value="UNDER_REVIEW">{tClaimStatus('UNDER_REVIEW')}</SelectItem>
                  <SelectItem value="APPROVED">{tClaimStatus('APPROVED')}</SelectItem>
                  <SelectItem value="PARTIALLY_APPROVED">
                    {tClaimStatus('PARTIALLY_APPROVED')}
                  </SelectItem>
                  <SelectItem value="REJECTED">{tClaimStatus('REJECTED')}</SelectItem>
                  <SelectItem value="SETTLED">{tClaimStatus('SETTLED')}</SelectItem>
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

      {/* Claims Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t('cols.claim')}</TableHead>
                <TableHead>{t('cols.patient')}</TableHead>
                <TableHead>{t('cols.provider')}</TableHead>
                <TableHead className="text-right">{t('cols.claimed')}</TableHead>
                <TableHead className="text-right">{t('cols.approved')}</TableHead>
                <TableHead>{t('cols.submitted')}</TableHead>
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
                      <Skeleton className="h-4 w-28" />
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
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-8" />
                    </TableCell>
                  </TableRow>
                ))
              ) : claims.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Shield className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">{t('empty')}</p>
                      <Link href="/billing/insurance/new">
                        <Button variant="outline" size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          {t('createNew')}
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                claims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell>
                      <div className="font-medium">{claim.claimNumber}</div>
                      <div className="text-sm text-muted-foreground">
                        {t('policy', { number: claim.policyNumber })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {claim.patient.firstName} {claim.patient.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {claim.patient.patientId}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{claim.insuranceProvider}</div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(claim.claimAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {claim.approvedAmount ? (
                        <span className="text-green-600 font-medium">
                          {formatCurrency(claim.approvedAmount)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {claim.submissionDate ? (
                        formatDate(claim.submissionDate)
                      ) : (
                        <span className="text-muted-foreground">{t('notSubmitted')}</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(claim.status)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => router.push(`/billing/insurance/${claim.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            {t('viewDetails')}
                          </DropdownMenuItem>
                          {claim.status === 'DRAFT' && (
                            <>
                              <DropdownMenuItem
                                onClick={() => router.push(`/billing/insurance/${claim.id}/edit`)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                {t('edit')}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleSubmitClaim(claim.id)}>
                                <Send className="h-4 w-4 mr-2" />
                                {t('submitClaim')}
                              </DropdownMenuItem>
                            </>
                          )}
                          {(claim.status === 'REJECTED' ||
                            claim.status === 'PARTIALLY_APPROVED') && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openDenialManagement(claim)}>
                                <Gavel className="h-4 w-4 mr-2" />
                                {t('denialAppeal')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAiAnalyze(claim)}>
                                <Brain className="h-4 w-4 mr-2" />
                                {t('aiAnalyze')}
                              </DropdownMenuItem>
                            </>
                          )}
                          {claim.invoices.length > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              {claim.invoices.map((invoice) => (
                                <DropdownMenuItem
                                  key={invoice.id}
                                  onClick={() => router.push(`/billing/invoices/${invoice.id}`)}
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  {t('viewInvoice', { no: invoice.invoiceNo })}
                                </DropdownMenuItem>
                              ))}
                            </>
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

      {/* Denial / Appeal Management Dialog */}
      <Dialog open={!!denialClaim} onOpenChange={() => setDenialClaim(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gavel className="h-5 w-5" />
              {t('denialTitle')}
            </DialogTitle>
          </DialogHeader>
          {denialClaim && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="font-medium">{denialClaim.claimNumber}</p>
                <p className="text-muted-foreground">
                  {denialClaim.patient.firstName} {denialClaim.patient.lastName} —{' '}
                  {denialClaim.insuranceProvider}
                </p>
                {denialClaim.rejectionReason && (
                  <p className="text-destructive mt-1">
                    {t('rejection', { reason: denialClaim.rejectionReason })}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('denialCode')}</Label>
                  <Input
                    value={denialForm.denialCode}
                    onChange={(e) => setDenialForm({ ...denialForm, denialCode: e.target.value })}
                    placeholder={t('denialCodePlaceholder')}
                  />
                </div>
                <div>
                  <Label>{t('appealDeadline')}</Label>
                  <Input
                    type="date"
                    value={denialForm.appealDeadline}
                    onChange={(e) =>
                      setDenialForm({ ...denialForm, appealDeadline: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <Label>{t('appealStatusLabel')}</Label>
                <Select
                  value={denialForm.appealStatus}
                  onValueChange={(v) => setDenialForm({ ...denialForm, appealStatus: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PREPARING">{tAppealStatus('PREPARING')}</SelectItem>
                    <SelectItem value="SUBMITTED">{tAppealStatus('SUBMITTED')}</SelectItem>
                    <SelectItem value="UNDER_REVIEW">{tAppealStatus('UNDER_REVIEW')}</SelectItem>
                    <SelectItem value="WON">{tAppealStatus('WON')}</SelectItem>
                    <SelectItem value="LOST">{tAppealStatus('LOST')}</SelectItem>
                    <SelectItem value="ABANDONED">{tAppealStatus('ABANDONED')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t('appealNotes')}</Label>
                <Textarea
                  value={denialForm.appealNotes}
                  onChange={(e) => setDenialForm({ ...denialForm, appealNotes: e.target.value })}
                  placeholder={t('appealNotesPlaceholder')}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDenialClaim(null)}>
                  {tCommon('actions.cancel')}
                </Button>
                <Button onClick={handleSaveDenialInfo}>{t('save')}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AI Analysis Dialog */}
      <Dialog
        open={!!aiAnalysisClaim}
        onOpenChange={() => {
          setAiAnalysisClaim(null)
          setAiAnalysis(null)
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              {t('aiTitle')}
            </DialogTitle>
          </DialogHeader>
          {aiAnalysisClaim && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="font-medium">{aiAnalysisClaim.claimNumber}</p>
                <p className="text-muted-foreground">
                  {aiAnalysisClaim.patient.firstName} {aiAnalysisClaim.patient.lastName} —{' '}
                  {aiAnalysisClaim.insuranceProvider}
                </p>
                <p className="text-muted-foreground">
                  {t('amount', { amount: formatCurrency(aiAnalysisClaim.claimAmount) })}
                </p>
                {aiAnalysisClaim.rejectionReason && (
                  <p className="text-destructive mt-1">
                    {t('rejection', { reason: aiAnalysisClaim.rejectionReason })}
                  </p>
                )}
              </div>

              {aiAnalyzing ? (
                <div className="flex items-center justify-center py-8 gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                  <span className="text-sm text-muted-foreground">{t('analyzing')}</span>
                </div>
              ) : aiAnalysis?.error ? (
                <p className="text-destructive text-sm">{aiAnalysis.error}</p>
              ) : aiAnalysis ? (
                <>
                  {/* Analysis */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">{t('analysisHeading')}</h4>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                      <p>
                        <span className="font-medium">{t('likelyCause')}</span>{' '}
                        {aiAnalysis.analysis?.likelyCause}
                      </p>
                      <p>
                        <span className="font-medium">{t('category')}</span>{' '}
                        {aiAnalysis.analysis?.denialCategory}
                      </p>
                      <p>
                        <span className="font-medium">{t('recoveryLikelihood')}</span>{' '}
                        {aiAnalysis.analysis?.severityOfDenial}
                      </p>
                    </div>
                  </div>

                  {/* Suggestions */}
                  {aiAnalysis.suggestions?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">{t('suggestions')}</h4>
                      <div className="space-y-1">
                        {aiAnalysis.suggestions.map((s: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <Badge
                              className={
                                s.priority === 'HIGH'
                                  ? 'bg-red-100 text-red-700 border-0 text-xs'
                                  : s.priority === 'MEDIUM'
                                    ? 'bg-amber-100 text-amber-700 border-0 text-xs'
                                    : 'bg-muted text-muted-foreground border-0 text-xs'
                              }
                            >
                              {s.priority}
                            </Badge>
                            <span>{s.action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Appeal Letter */}
                  {aiAnalysis.appealLetter && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">{t('draftAppeal')}</h4>
                      <Textarea
                        value={aiAnalysis.appealLetter}
                        readOnly
                        rows={8}
                        className="text-sm font-mono"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(aiAnalysis.appealLetter)}
                      >
                        {t('copyClipboard')}
                      </Button>
                    </div>
                  )}

                  {/* Prevention Tips */}
                  {aiAnalysis.preventionTips?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">{t('preventionTips')}</h4>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        {aiAnalysis.preventionTips.map((tip: string, i: number) => (
                          <p key={i} className="text-xs text-blue-600">
                            • {tip}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setAiAnalysisClaim(null)
                    setAiAnalysis(null)
                  }}
                >
                  {t('close')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
