'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { useToast } from '@/hooks/use-toast'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'
import {
  BarChart3,
  Mail,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Eye,
  MousePointerClick,
  Loader2,
  RefreshCw,
  Send,
  XCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react'

interface AnalyticsData {
  period: string
  sms: {
    total: number
    delivered: number
    sent: number
    failed: number
    pending: number
    queued: number
    deliveryRate: number
    totalCost: number
  }
  email: {
    total: number
    sent: number
    failed: number
    opened: number
    clicked: number
    openRate: number
    clickRate: number
  }
  dailyTrend: Array<{ date: string; sms: number; email: number }>
  campaigns: Array<{
    id: string
    name: string
    channel: string
    status: string
    recipientCount: number
    sentCount: number
    failedCount: number
    estimatedCost: number
    actualCost: number
    createdAt: string
  }>
  topTemplates: {
    sms: Array<{ templateId: string; name: string; category: string; count: number }>
    email: Array<{ templateId: string; name: string; category: string; count: number }>
  }
}

export default function CampaignAnalyticsPage() {
  const { toast } = useToast()
  const t = useTranslations('communications.analytics')
  const tp = useTranslations('communications.period')
  const tc = useTranslations('communications.common')
  const { formatNumber, formatCurrency, formatDate } = useClinicFormatters()
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30d')
  const [data, setData] = useState<AnalyticsData | null>(null)

  const fetchAnalytics = async (p: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/communications/analytics?period=${p}`)
      if (!res.ok) throw new Error('Failed to fetch analytics')
      const json = await res.json()
      setData(json)
    } catch (err: any) {
      toast({ title: tc('error'), description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics(period)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  const maxDailyVolume = data?.dailyTrend
    ? Math.max(...data.dailyTrend.map((d) => d.sms + d.email), 1)
    : 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">{tp('7d')}</SelectItem>
              <SelectItem value="30d">{tp('30d')}</SelectItem>
              <SelectItem value="90d">{tp('90d')}</SelectItem>
              <SelectItem value="all">{tp('all')}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => fetchAnalytics(period)}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          {/* SMS Stats Cards */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {t('sms.heading')}
            </h3>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('sms.totalSent')}</CardTitle>
                  <Send className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatNumber(data.sms.total)}</div>
                  <p className="text-xs text-muted-foreground">
                    {data.sms.pending + data.sms.queued > 0
                      ? t('sms.pending', { count: data.sms.pending + data.sms.queued })
                      : t('sms.allProcessed')}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('sms.deliveryRate')}</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.sms.deliveryRate}%</div>
                  <p className="text-xs text-muted-foreground">
                    {t('sms.deliveredCount', { count: data.sms.delivered + data.sms.sent })}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('sms.failed')}</CardTitle>
                  <XCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{data.sms.failed}</div>
                  <p className="text-xs text-muted-foreground">
                    {data.sms.total > 0
                      ? t('failureRate', {
                          rate: ((data.sms.failed / data.sms.total) * 100).toFixed(1),
                        })
                      : t('noMessages')}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('sms.totalCost')}</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(data.sms.totalCost, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {data.sms.total > 0
                      ? t('sms.costPerMsg', {
                          cost: formatCurrency(data.sms.totalCost / data.sms.total, {
                            minimumFractionDigits: 4,
                            maximumFractionDigits: 4,
                          }),
                        })
                      : t('sms.noCostData')}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Email Stats Cards */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {t('email.heading')}
            </h3>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('email.totalSent')}</CardTitle>
                  <Send className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatNumber(data.email.total)}</div>
                  <p className="text-xs text-muted-foreground">
                    {t('email.deliveredCount', { count: data.email.sent })}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('email.openRate')}</CardTitle>
                  <Eye className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.email.openRate}%</div>
                  <p className="text-xs text-muted-foreground">
                    {t('email.openedOf', { opened: data.email.opened, sent: data.email.sent })}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('email.clickRate')}</CardTitle>
                  <MousePointerClick className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.email.clickRate}%</div>
                  <p className="text-xs text-muted-foreground">
                    {t('email.clickedOf', { clicked: data.email.clicked, sent: data.email.sent })}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('email.failed')}</CardTitle>
                  <XCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{data.email.failed}</div>
                  <p className="text-xs text-muted-foreground">
                    {data.email.total > 0
                      ? t('failureRate', {
                          rate: ((data.email.failed / data.email.total) * 100).toFixed(1),
                        })
                      : t('noMessages')}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Daily Trend Chart (CSS-based bar chart) */}
          {data.dailyTrend.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  {t('dailyVolume.title')}
                </CardTitle>
                <CardDescription>{t('dailyVolume.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-1 h-[200px] overflow-x-auto pb-6">
                  {data.dailyTrend.slice(-30).map((day) => {
                    const total = day.sms + day.email
                    const smsHeight = maxDailyVolume > 0 ? (day.sms / maxDailyVolume) * 180 : 0
                    const emailHeight = maxDailyVolume > 0 ? (day.email / maxDailyVolume) * 180 : 0
                    return (
                      <div
                        key={day.date}
                        className="flex flex-col items-center flex-1 min-w-[20px] group relative"
                      >
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-popover border rounded px-2 py-1 whitespace-nowrap z-10">
                          {t('dailyVolume.tooltip', {
                            date: day.date,
                            sms: day.sms,
                            email: day.email,
                          })}
                        </div>
                        <div className="flex flex-col-reverse w-full gap-[1px]">
                          {day.sms > 0 && (
                            <div
                              className="bg-blue-500 rounded-t-sm w-full"
                              style={{ height: `${Math.max(smsHeight, 2)}px` }}
                            />
                          )}
                          {day.email > 0 && (
                            <div
                              className="bg-purple-500 rounded-t-sm w-full"
                              style={{ height: `${Math.max(emailHeight, 2)}px` }}
                            />
                          )}
                          {total === 0 && (
                            <div
                              className="bg-muted rounded-t-sm w-full"
                              style={{ height: '2px' }}
                            />
                          )}
                        </div>
                        <span className="text-[9px] text-muted-foreground mt-1 rotate-45 origin-left">
                          {day.date.slice(5)}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-blue-500" /> {t('dailyVolume.smsLegend')}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-purple-500" />{' '}
                    {t('dailyVolume.emailLegend')}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Campaign Comparison */}
          {data.campaigns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('campaigns.title')}</CardTitle>
                <CardDescription>{t('campaigns.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('campaigns.colCampaign')}</TableHead>
                      <TableHead>{t('campaigns.colChannel')}</TableHead>
                      <TableHead>{t('campaigns.colStatus')}</TableHead>
                      <TableHead className="text-right">{t('campaigns.colRecipients')}</TableHead>
                      <TableHead className="text-right">{t('campaigns.colSent')}</TableHead>
                      <TableHead className="text-right">{t('campaigns.colFailed')}</TableHead>
                      <TableHead className="text-right">{t('campaigns.colCost')}</TableHead>
                      <TableHead>{t('campaigns.colDate')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.campaigns.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {t.has(`channel.${c.channel}`) ? t(`channel.${c.channel}`) : c.channel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              c.status === 'COMPLETED'
                                ? 'default'
                                : c.status === 'FAILED'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {t.has(`campaignStatus.${c.status}`)
                              ? t(`campaignStatus.${c.status}`)
                              : c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{c.recipientCount}</TableCell>
                        <TableCell className="text-right text-green-600">{c.sentCount}</TableCell>
                        <TableCell className="text-right text-red-600">{c.failedCount}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(c.actualCost > 0 ? c.actualCost : c.estimatedCost, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(c.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Top Templates */}
          <div className="grid gap-6 md:grid-cols-2">
            {data.topTemplates.sms.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    {t('topSmsTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.topTemplates.sms.map((tpl, i) => (
                      <div key={tpl.templateId} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground w-5">{i + 1}.</span>
                          <div>
                            <p className="text-sm font-medium">{tpl.name}</p>
                            <Badge variant="outline" className="text-xs">
                              {tpl.category}
                            </Badge>
                          </div>
                        </div>
                        <span className="text-sm font-semibold">
                          {t('sentCount', { count: tpl.count })}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {data.topTemplates.email.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {t('topEmailTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.topTemplates.email.map((tpl, i) => (
                      <div key={tpl.templateId} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground w-5">{i + 1}.</span>
                          <div>
                            <p className="text-sm font-medium">{tpl.name}</p>
                            <Badge variant="outline" className="text-xs">
                              {tpl.category}
                            </Badge>
                          </div>
                        </div>
                        <span className="text-sm font-semibold">
                          {t('sentCount', { count: tpl.count })}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Empty state */}
          {data.sms.total === 0 && data.email.total === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">{t('empty.title')}</h3>
                <p className="text-muted-foreground text-sm mt-1">{t('empty.description')}</p>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  )
}
