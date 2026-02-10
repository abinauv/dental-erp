"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
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
} from "lucide-react"

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
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState("30d")
  const [data, setData] = useState<AnalyticsData | null>(null)

  const fetchAnalytics = async (p: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/communications/analytics?period=${p}`)
      if (!res.ok) throw new Error("Failed to fetch analytics")
      const json = await res.json()
      setData(json)
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics(period)
  }, [period])

  const maxDailyVolume = data?.dailyTrend
    ? Math.max(...data.dailyTrend.map((d) => d.sms + d.email), 1)
    : 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Campaign Analytics</h2>
          <p className="text-muted-foreground">
            SMS delivery rates, email engagement, and campaign performance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => fetchAnalytics(period)}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
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
              SMS Overview
            </h3>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
                  <Send className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.sms.total.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    {data.sms.pending + data.sms.queued > 0
                      ? `${data.sms.pending + data.sms.queued} pending`
                      : "All processed"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.sms.deliveryRate}%</div>
                  <p className="text-xs text-muted-foreground">
                    {data.sms.delivered + data.sms.sent} delivered
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Failed</CardTitle>
                  <XCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{data.sms.failed}</div>
                  <p className="text-xs text-muted-foreground">
                    {data.sms.total > 0
                      ? `${((data.sms.failed / data.sms.total) * 100).toFixed(1)}% failure rate`
                      : "No messages"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ₹{data.sms.totalCost.toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {data.sms.total > 0
                      ? `₹${(data.sms.totalCost / data.sms.total).toFixed(4)}/msg`
                      : "No cost data"}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Email Stats Cards */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Overview
            </h3>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
                  <Send className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.email.total.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    {data.email.sent} successfully delivered
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
                  <Eye className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.email.openRate}%</div>
                  <p className="text-xs text-muted-foreground">
                    {data.email.opened} opened of {data.email.sent}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
                  <MousePointerClick className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.email.clickRate}%</div>
                  <p className="text-xs text-muted-foreground">
                    {data.email.clicked} clicked of {data.email.sent}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Failed</CardTitle>
                  <XCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{data.email.failed}</div>
                  <p className="text-xs text-muted-foreground">
                    {data.email.total > 0
                      ? `${((data.email.failed / data.email.total) * 100).toFixed(1)}% failure rate`
                      : "No messages"}
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
                  Daily Message Volume
                </CardTitle>
                <CardDescription>
                  SMS and email messages sent per day
                </CardDescription>
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
                          {day.date}: {day.sms} SMS, {day.email} Email
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
                            <div className="bg-muted rounded-t-sm w-full" style={{ height: "2px" }} />
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
                    <span className="w-3 h-3 rounded-sm bg-blue-500" /> SMS
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-purple-500" /> Email
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Campaign Comparison */}
          {data.campaigns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Campaigns</CardTitle>
                <CardDescription>Bulk communication campaign performance</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Recipients</TableHead>
                      <TableHead className="text-right">Sent</TableHead>
                      <TableHead className="text-right">Failed</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.campaigns.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{c.channel}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              c.status === "COMPLETED"
                                ? "default"
                                : c.status === "FAILED"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{c.recipientCount}</TableCell>
                        <TableCell className="text-right text-green-600">{c.sentCount}</TableCell>
                        <TableCell className="text-right text-red-600">{c.failedCount}</TableCell>
                        <TableCell className="text-right">
                          ₹{c.actualCost > 0 ? c.actualCost.toFixed(2) : c.estimatedCost.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(c.createdAt).toLocaleDateString()}
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
                    Top SMS Templates
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.topTemplates.sms.map((t, i) => (
                      <div key={t.templateId} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground w-5">{i + 1}.</span>
                          <div>
                            <p className="text-sm font-medium">{t.name}</p>
                            <Badge variant="outline" className="text-xs">
                              {t.category}
                            </Badge>
                          </div>
                        </div>
                        <span className="text-sm font-semibold">{t.count} sent</span>
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
                    Top Email Templates
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.topTemplates.email.map((t, i) => (
                      <div key={t.templateId} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground w-5">{i + 1}.</span>
                          <div>
                            <p className="text-sm font-medium">{t.name}</p>
                            <Badge variant="outline" className="text-xs">
                              {t.category}
                            </Badge>
                          </div>
                        </div>
                        <span className="text-sm font-semibold">{t.count} sent</span>
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
                <h3 className="text-lg font-semibold">No analytics data yet</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Start sending SMS and emails to see campaign analytics here
                </p>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  )
}
