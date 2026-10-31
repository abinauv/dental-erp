'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Plus,
  Receipt,
  CreditCard,
  TrendingUp,
  AlertCircle,
  IndianRupee,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  BarChart3,
  CalendarClock,
  Brain,
  Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { dateRangePresets } from '@/lib/billing-utils'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'
import { ExportMenu } from '@/components/ui/export-menu'

interface SummaryData {
  summary: {
    totalBilled: number
    totalDiscounts: number
    invoiceCount: number
    totalCollected: number
    paymentCount: number
    totalOutstanding: number
    outstandingInvoices: number
    insuranceClaimed: number
    insuranceSettled: number
    insuranceClaimCount: number
  }
  breakdowns: {
    byPaymentMethod: Array<{
      method: string
      amount: number
      count: number
    }>
    byInvoiceStatus: Array<{
      status: string
      amount: number
      count: number
    }>
  }
}

interface AgingData {
  aging: {
    current: { amount: number; count: number }
    days1_30: { amount: number; count: number }
    days31_60: { amount: number; count: number }
    days61_90: { amount: number; count: number }
    over90: { amount: number; count: number }
  }
  totals: { totalOutstanding: number; invoiceCount: number }
}

interface PlanSummary {
  active: number
  completed: number
  defaulted: number
  totalOutstanding: number
}

export default function BillingPage() {
  const t = useTranslations('billing.dashboard')
  const tStatus = useTranslations('billing.status')
  const tMethods = useTranslations('billing.paymentMethods')
  const { formatCurrency: fc } = useClinicFormatters()
  const formatCurrency = (amount: Parameters<typeof fc>[0]) =>
    fc(amount, { minimumFractionDigits: 2 })
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<SummaryData | null>(null)
  const [datePreset, setDatePreset] = useState('this_month')
  const [error, setError] = useState<string | null>(null)
  const [agingData, setAgingData] = useState<AgingData | null>(null)
  const [planSummary, setPlanSummary] = useState<PlanSummary | null>(null)

  // AI Cash Flow Forecast
  const [cashFlowData, setCashFlowData] = useState<any>(null)
  const [cashFlowLoading, setCashFlowLoading] = useState(false)

  const fetchCashFlowForecast = async () => {
    try {
      setCashFlowLoading(true)
      const res = await fetch('/api/ai/cashflow-forecast')
      if (!res.ok) return
      setCashFlowData(await res.json())
    } catch {
      // non-critical
    } finally {
      setCashFlowLoading(false)
    }
  }

  const fetchSummary = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/billing/reports?type=summary&preset=${datePreset}`)
      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.details
          ? `${errorData.error}: ${errorData.details}`
          : errorData.error || 'Failed to fetch summary'
        throw new Error(errorMessage)
      }
      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('Error fetching billing summary:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch summary')
    } finally {
      setLoading(false)
    }
  }

  const fetchRevenueCycle = async () => {
    try {
      const [agingRes, plansRes] = await Promise.all([
        fetch('/api/billing/reports?type=outstanding'),
        fetch('/api/payment-plans?limit=1'),
      ])
      if (agingRes.ok) {
        const d = await agingRes.json()
        setAgingData(d)
      }
      if (plansRes.ok) {
        const d = await plansRes.json()
        setPlanSummary(d.summary)
      }
    } catch {
      // non-critical
    }
  }

  useEffect(() => {
    fetchSummary()
    fetchRevenueCycle()
  }, [datePreset])

  const invoiceStatusColors: Record<string, string> = {
    DRAFT: 'text-muted-foreground',
    PENDING: 'text-yellow-600',
    PARTIALLY_PAID: 'text-blue-600',
    PAID: 'text-green-600',
    OVERDUE: 'text-red-600',
    CANCELLED: 'text-muted-foreground',
    REFUNDED: 'text-purple-600',
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
          <Select value={datePreset} onValueChange={setDatePreset}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={t('selectPeriod')} />
            </SelectTrigger>
            <SelectContent>
              {dateRangePresets
                .filter((p) => p.value !== 'custom')
                .map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <ExportMenu
            filename="billing-summary"
            getData={() => {
              const rows: Record<string, unknown>[] = []
              if (data) {
                rows.push({
                  Metric: 'Total Billed',
                  Amount: data.summary.totalBilled,
                  Count: data.summary.invoiceCount,
                })
                rows.push({
                  Metric: 'Total Collected',
                  Amount: data.summary.totalCollected,
                  Count: data.summary.paymentCount,
                })
                rows.push({
                  Metric: 'Total Outstanding',
                  Amount: data.summary.totalOutstanding,
                  Count: data.summary.outstandingInvoices,
                })
                rows.push({
                  Metric: 'Total Discounts',
                  Amount: data.summary.totalDiscounts,
                  Count: '',
                })
                rows.push({
                  Metric: 'Insurance Claimed',
                  Amount: data.summary.insuranceClaimed,
                  Count: data.summary.insuranceClaimCount,
                })
                rows.push({
                  Metric: 'Insurance Settled',
                  Amount: data.summary.insuranceSettled,
                  Count: '',
                })
                data.breakdowns.byPaymentMethod.forEach((m) => {
                  rows.push({
                    Metric: `Payment Method: ${m.method}`,
                    Amount: m.amount,
                    Count: m.count,
                  })
                })
                data.breakdowns.byInvoiceStatus.forEach((s) => {
                  rows.push({
                    Metric: `Invoice Status: ${s.status}`,
                    Amount: s.amount,
                    Count: s.count,
                  })
                })
              }
              return rows
            }}
          />
          <Link href="/billing/invoices/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t('newInvoice')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="font-medium text-red-900">{t('errorTitle')}</p>
                <p className="text-sm text-red-700">{error}</p>
                {error.includes('permission') && (
                  <p className="text-xs text-red-600 mt-1">{t('permissionHint')}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Billed */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalBilled')}</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatCurrency(data?.summary.totalBilled || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('invoicesCount', { count: data?.summary.invoiceCount || 0 })}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Total Collected */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalCollected')}</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(data?.summary.totalCollected || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('paymentsReceived', { count: data?.summary.paymentCount || 0 })}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Outstanding */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('outstanding')}</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(data?.summary.totalOutstanding || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('pendingInvoices', { count: data?.summary.outstandingInvoices || 0 })}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Insurance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('insuranceClaims')}</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatCurrency(data?.summary.insuranceClaimed || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('settled', { amount: formatCurrency(data?.summary.insuranceSettled || 0) })}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Breakdowns */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>{t('quickActions')}</CardTitle>
            <CardDescription>{t('quickActionsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/billing/invoices" className="block">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                {t('viewAllInvoices')}
              </Button>
            </Link>
            <Link href="/billing/payments" className="block">
              <Button variant="outline" className="w-full justify-start">
                <CreditCard className="h-4 w-4 mr-2" />
                {t('viewAllPayments')}
              </Button>
            </Link>
            <Link href="/billing/payment-plans" className="block">
              <Button variant="outline" className="w-full justify-start">
                <CalendarClock className="h-4 w-4 mr-2" />
                {t('paymentPlans')}
              </Button>
            </Link>
            <Link href="/billing/insurance" className="block">
              <Button variant="outline" className="w-full justify-start">
                <Shield className="h-4 w-4 mr-2" />
                {t('insuranceClaims')}
              </Button>
            </Link>
            <Link href="/billing/insurance/providers" className="block">
              <Button variant="outline" className="w-full justify-start">
                <Shield className="h-4 w-4 mr-2" />
                {t('insuranceProviders')}
              </Button>
            </Link>
            <Link href="/billing/insurance/pre-auth" className="block">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                {t('preAuth')}
              </Button>
            </Link>
            <Link href="/billing/reports" className="block">
              <Button variant="outline" className="w-full justify-start">
                <BarChart3 className="h-4 w-4 mr-2" />
                {t('financialReports')}
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle>{t('paymentMethodsTitle')}</CardTitle>
            <CardDescription>{t('paymentMethodsDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {data?.breakdowns.byPaymentMethod.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t('noPayments')}
                  </p>
                ) : (
                  data?.breakdowns.byPaymentMethod.map((method) => (
                    <div key={method.method} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {tMethods.has(method.method) ? tMethods(method.method) : method.method}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(method.amount)}</div>
                        <div className="text-xs text-muted-foreground">
                          {t('paymentsCount', { count: method.count })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoice Status */}
        <Card>
          <CardHeader>
            <CardTitle>{t('invoiceStatusTitle')}</CardTitle>
            <CardDescription>{t('invoiceStatusDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {data?.breakdowns.byInvoiceStatus.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t('noInvoices')}
                  </p>
                ) : (
                  data?.breakdowns.byInvoiceStatus.map((status) => {
                    const color = invoiceStatusColors[status.status] || 'text-muted-foreground'
                    const label = tStatus.has(status.status)
                      ? tStatus(status.status)
                      : status.status
                    return (
                      <div key={status.status} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {status.status === 'PAID' && (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                          {status.status === 'PENDING' && (
                            <Clock className="h-4 w-4 text-yellow-500" />
                          )}
                          {status.status === 'OVERDUE' && (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                          {status.status === 'CANCELLED' && (
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          )}
                          {!['PAID', 'PENDING', 'OVERDUE', 'CANCELLED'].includes(status.status) && (
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className={`text-sm ${color}`}>{label}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(status.amount)}</div>
                          <div className="text-xs text-muted-foreground">
                            {t('invoicesCount', { count: status.count })}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Collection Rate */}
      {!loading && data && (
        <Card>
          <CardHeader>
            <CardTitle>{t('collectionRate')}</CardTitle>
            <CardDescription>{t('collectionRateDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">{t('collectionProgress')}</span>
                  <span className="text-sm font-medium">
                    {data.summary.totalBilled > 0
                      ? Math.round((data.summary.totalCollected / data.summary.totalBilled) * 100)
                      : 0}
                    %
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        data.summary.totalBilled > 0
                          ? Math.min(
                              100,
                              Math.round(
                                (data.summary.totalCollected / data.summary.totalBilled) * 100
                              )
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
              <div className="flex gap-6 text-sm">
                <div>
                  <div className="text-muted-foreground">{t('billed')}</div>
                  <div className="font-medium">{formatCurrency(data.summary.totalBilled)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t('collected')}</div>
                  <div className="font-medium text-green-600">
                    {formatCurrency(data.summary.totalCollected)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t('discounts')}</div>
                  <div className="font-medium text-orange-600">
                    {formatCurrency(data.summary.totalDiscounts)}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Cash Flow Forecast */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-600" />
                {t('cashFlowForecast')}
              </CardTitle>
              <CardDescription>{t('cashFlowDesc')}</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchCashFlowForecast}
              disabled={cashFlowLoading}
            >
              {cashFlowLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Brain className="h-4 w-4 mr-2" />
              )}
              {cashFlowData ? t('refresh') : t('generateForecast')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!cashFlowData ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t('generateHint')}</p>
          ) : (
            <div className="space-y-4">
              {/* Summary row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-green-50">
                  <div className="text-lg font-bold text-green-700">
                    {formatCurrency(cashFlowData.summary?.total30Day || 0)}
                  </div>
                  <div className="text-xs text-green-600">{t('projected30')}</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-blue-50">
                  <div className="text-lg font-bold text-blue-700">
                    {formatCurrency(cashFlowData.summary?.avgDaily || 0)}
                  </div>
                  <div className="text-xs text-blue-600">{t('avgDaily')}</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-purple-50">
                  <div className="text-lg font-bold text-purple-700">
                    {cashFlowData.summary?.bestDay || 'N/A'}
                  </div>
                  <div className="text-xs text-purple-600">{t('bestDay')}</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-amber-50">
                  <Badge
                    className={
                      cashFlowData.summary?.trend === 'GROWING'
                        ? 'bg-green-100 text-green-700 border-0'
                        : cashFlowData.summary?.trend === 'DECLINING'
                          ? 'bg-red-100 text-red-700 border-0'
                          : 'bg-muted text-muted-foreground border-0'
                    }
                  >
                    {cashFlowData.summary?.trend || 'STABLE'}
                  </Badge>
                  <div className="text-xs text-amber-600 mt-1">{t('trend')}</div>
                </div>
              </div>

              {/* Weekly totals */}
              {cashFlowData.weeklyTotals?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">{t('weeklyBreakdown')}</h4>
                  {cashFlowData.weeklyTotals.map((week: any) => (
                    <div key={week.week} className="flex items-center justify-between text-sm">
                      <span>
                        {t('weekRange', {
                          week: week.week,
                          start: week.startDate,
                          end: week.endDate,
                        })}
                      </span>
                      <span className="font-medium">{formatCurrency(week.projected)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Shortfall warnings */}
              {cashFlowData.summary?.potentialShortfalls?.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-amber-700 mb-1">
                    <AlertCircle className="h-4 w-4" />
                    {t('potentialShortfalls')}
                  </div>
                  {cashFlowData.summary.potentialShortfalls.map((s: string, i: number) => (
                    <p key={i} className="text-xs text-amber-600">
                      • {s}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revenue Cycle Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Claims Aging */}
        <Card>
          <CardHeader>
            <CardTitle>{t('claimsAging')}</CardTitle>
            <CardDescription>{t('claimsAgingDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {!agingData ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  {
                    label: t('agingCurrent'),
                    data: agingData.aging.current,
                    color: 'bg-green-500',
                  },
                  { label: t('aging1_30'), data: agingData.aging.days1_30, color: 'bg-yellow-500' },
                  {
                    label: t('aging31_60'),
                    data: agingData.aging.days31_60,
                    color: 'bg-orange-500',
                  },
                  { label: t('aging61_90'), data: agingData.aging.days61_90, color: 'bg-red-400' },
                  { label: t('aging90'), data: agingData.aging.over90, color: 'bg-red-600' },
                ].map((bucket) => {
                  const total = agingData.totals.totalOutstanding || 1
                  const pct = Math.round((bucket.data.amount / total) * 100)
                  return (
                    <div key={bucket.label} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{bucket.label}</span>
                        <div className="text-right">
                          <span className="font-medium">{formatCurrency(bucket.data.amount)}</span>
                          <span className="text-muted-foreground ml-2">({bucket.data.count})</span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${bucket.color}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
                <div className="pt-2 border-t flex justify-between text-sm font-medium">
                  <span>{t('totalOutstanding')}</span>
                  <span className="text-red-600">
                    {formatCurrency(agingData.totals.totalOutstanding)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Plans Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t('paymentPlans')}</CardTitle>
                <CardDescription>{t('plansDesc')}</CardDescription>
              </div>
              <Link href="/billing/payment-plans">
                <Button variant="outline" size="sm">
                  {t('viewAll')}
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {!planSummary ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 rounded-lg bg-blue-50">
                    <div className="text-2xl font-bold text-blue-700">{planSummary.active}</div>
                    <div className="text-xs text-blue-600">{t('activePlans')}</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-green-50">
                    <div className="text-2xl font-bold text-green-700">{planSummary.completed}</div>
                    <div className="text-xs text-green-600">{t('completed')}</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-red-50">
                    <div className="text-2xl font-bold text-red-700">{planSummary.defaulted}</div>
                    <div className="text-xs text-red-600">{t('defaulted')}</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-orange-50">
                    <div className="text-2xl font-bold text-orange-700">
                      {formatCurrency(planSummary.totalOutstanding)}
                    </div>
                    <div className="text-xs text-orange-600">{t('outstandingEmi')}</div>
                  </div>
                </div>
                <div className="pt-2">
                  <Link href="/billing/payment-plans/new">
                    <Button className="w-full" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      {t('createPlan')}
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
