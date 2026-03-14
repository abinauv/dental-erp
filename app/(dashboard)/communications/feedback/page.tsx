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
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  Smile,
  Meh,
  Frown,
  Loader2,
  RefreshCw,
  MessageCircle,
  Users,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react"

interface FeedbackData {
  period: string
  totalSurveys: number
  totalResponses: number
  responseRate: number
  avgRating: number
  nps: {
    score: number
    promoters: number
    passives: number
    detractors: number
    trend: Array<{ month: string; score: number; responses: number }>
  }
  satisfaction: {
    byDoctor: Array<{ doctorName: string; avgRating: number; count: number }>
    byProcedure: Array<{ procedureName: string; avgRating: number; count: number }>
    byMonth: Array<{ month: string; avgRating: number; count: number }>
  }
  sentimentBreakdown: { positive: number; neutral: number; negative: number }
  wordFrequencies: Array<{ word: string; count: number }>
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i <= Math.round(rating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
          }`}
        />
      ))}
      <span className="ml-1 text-sm font-medium">{rating}</span>
    </div>
  )
}

export default function FeedbackAnalyticsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState("30d")
  const [data, setData] = useState<FeedbackData | null>(null)

  const fetchData = async (p: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/communications/feedback/analytics?period=${p}`)
      if (!res.ok) throw new Error("Failed to fetch analytics")
      setData(await res.json())
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData(period)
  }, [period])

  const npsColor = (score: number) =>
    score >= 50 ? "text-green-600" : score >= 0 ? "text-yellow-600" : "text-red-600"

  const sentimentTotal = data
    ? data.sentimentBreakdown.positive + data.sentimentBreakdown.neutral + data.sentimentBreakdown.negative
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Feedback Analytics</h2>
          <p className="text-muted-foreground">
            Patient satisfaction scores, NPS trends, and feedback insights
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
          <Button variant="outline" size="icon" onClick={() => fetchData(period)}>
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
          {/* Overview Cards */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.totalResponses}</div>
                <p className="text-xs text-muted-foreground">
                  From {data.totalSurveys} active surveys
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
                <Star className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.avgRating}/5</div>
                <StarRating rating={data.avgRating} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">NPS Score</CardTitle>
                {data.nps.score >= 0 ? (
                  <ThumbsUp className="h-4 w-4 text-green-500" />
                ) : (
                  <ThumbsDown className="h-4 w-4 text-red-500" />
                )}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${npsColor(data.nps.score)}`}>
                  {data.nps.score > 0 ? "+" : ""}
                  {data.nps.score}
                </div>
                <p className="text-xs text-muted-foreground">
                  {data.nps.score >= 50
                    ? "Excellent"
                    : data.nps.score >= 0
                      ? "Good"
                      : "Needs improvement"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.responseRate}%</div>
                <p className="text-xs text-muted-foreground">Completion rate</p>
              </CardContent>
            </Card>
          </div>

          {/* NPS Breakdown + Sentiment */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* NPS Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>NPS Breakdown</CardTitle>
                <CardDescription>
                  Promoters (4-5), Passives (3), Detractors (1-2)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stacked bar */}
                {data.totalResponses > 0 && (
                  <div className="flex h-8 rounded-md overflow-hidden">
                    {data.nps.promoters > 0 && (
                      <div
                        className="bg-green-500 flex items-center justify-center text-xs text-white font-medium"
                        style={{
                          width: `${(data.nps.promoters / (data.nps.promoters + data.nps.passives + data.nps.detractors)) * 100}%`,
                        }}
                      >
                        {data.nps.promoters}
                      </div>
                    )}
                    {data.nps.passives > 0 && (
                      <div
                        className="bg-yellow-400 flex items-center justify-center text-xs text-white font-medium"
                        style={{
                          width: `${(data.nps.passives / (data.nps.promoters + data.nps.passives + data.nps.detractors)) * 100}%`,
                        }}
                      >
                        {data.nps.passives}
                      </div>
                    )}
                    {data.nps.detractors > 0 && (
                      <div
                        className="bg-red-500 flex items-center justify-center text-xs text-white font-medium"
                        style={{
                          width: `${(data.nps.detractors / (data.nps.promoters + data.nps.passives + data.nps.detractors)) * 100}%`,
                        }}
                      >
                        {data.nps.detractors}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-green-500" />
                    Promoters ({data.nps.promoters})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-yellow-400" />
                    Passives ({data.nps.passives})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-red-500" />
                    Detractors ({data.nps.detractors})
                  </span>
                </div>

                {/* NPS Trend */}
                {data.nps.trend.length > 1 && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-2">Monthly NPS Trend</p>
                    <div className="flex items-end gap-2 h-[100px]">
                      {data.nps.trend.map((t) => {
                        const normalized = ((t.score + 100) / 200) * 100 // -100..100 → 0..100
                        return (
                          <div key={t.month} className="flex flex-col items-center flex-1 group relative">
                            <div className="absolute -top-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-popover border rounded px-1.5 py-0.5 whitespace-nowrap z-10">
                              {t.month}: {t.score > 0 ? "+" : ""}{t.score} ({t.responses})
                            </div>
                            <div
                              className={`w-full rounded-t-sm ${t.score >= 0 ? "bg-green-500" : "bg-red-400"}`}
                              style={{ height: `${Math.max(normalized, 4)}%` }}
                            />
                            <span className="text-[9px] text-muted-foreground mt-1">
                              {t.month.slice(5)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sentiment */}
            <Card>
              <CardHeader>
                <CardTitle>Sentiment Analysis</CardTitle>
                <CardDescription>Overall patient sentiment from feedback</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm">
                      <Smile className="h-5 w-5 text-green-500" />
                      Positive
                    </span>
                    <span className="font-semibold">{data.sentimentBreakdown.positive}</span>
                  </div>
                  {sentimentTotal > 0 && (
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{
                          width: `${(data.sentimentBreakdown.positive / sentimentTotal) * 100}%`,
                        }}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm">
                      <Meh className="h-5 w-5 text-yellow-500" />
                      Neutral
                    </span>
                    <span className="font-semibold">{data.sentimentBreakdown.neutral}</span>
                  </div>
                  {sentimentTotal > 0 && (
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-yellow-400 h-2 rounded-full"
                        style={{
                          width: `${(data.sentimentBreakdown.neutral / sentimentTotal) * 100}%`,
                        }}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm">
                      <Frown className="h-5 w-5 text-red-500" />
                      Negative
                    </span>
                    <span className="font-semibold">{data.sentimentBreakdown.negative}</span>
                  </div>
                  {sentimentTotal > 0 && (
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-red-500 h-2 rounded-full"
                        style={{
                          width: `${(data.sentimentBreakdown.negative / sentimentTotal) * 100}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Satisfaction Breakdowns */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* By Doctor */}
            {data.satisfaction.byDoctor.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Satisfaction by Doctor</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Doctor</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead className="text-right">Responses</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.satisfaction.byDoctor.map((d) => (
                        <TableRow key={d.doctorName}>
                          <TableCell className="font-medium">{d.doctorName}</TableCell>
                          <TableCell>
                            <StarRating rating={d.avgRating} />
                          </TableCell>
                          <TableCell className="text-right">{d.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* By Procedure */}
            {data.satisfaction.byProcedure.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Satisfaction by Procedure</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Procedure</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead className="text-right">Responses</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.satisfaction.byProcedure.map((p) => (
                        <TableRow key={p.procedureName}>
                          <TableCell className="font-medium">{p.procedureName}</TableCell>
                          <TableCell>
                            <StarRating rating={p.avgRating} />
                          </TableCell>
                          <TableCell className="text-right">{p.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Monthly Rating Trend */}
          {data.satisfaction.byMonth.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Rating Trend
                </CardTitle>
                <CardDescription>Average satisfaction rating by month</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-3 h-[140px]">
                  {data.satisfaction.byMonth.map((m) => {
                    const pct = (m.avgRating / 5) * 100
                    return (
                      <div key={m.month} className="flex flex-col items-center flex-1 group relative">
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-popover border rounded px-2 py-1 whitespace-nowrap z-10">
                          {m.month}: {m.avgRating}/5 ({m.count} responses)
                        </div>
                        <div
                          className={`w-full rounded-t-sm ${
                            m.avgRating >= 4
                              ? "bg-green-500"
                              : m.avgRating >= 3
                                ? "bg-yellow-400"
                                : "bg-red-400"
                          }`}
                          style={{ height: `${Math.max(pct, 4)}%` }}
                        />
                        <span className="text-[10px] text-muted-foreground mt-1">{m.month.slice(5)}</span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Word Cloud */}
          {data.wordFrequencies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Feedback Word Cloud</CardTitle>
                <CardDescription>Most frequent words from patient feedback</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {data.wordFrequencies.map((w, i) => {
                    const maxCount = data.wordFrequencies[0]?.count || 1
                    const scale = 0.7 + (w.count / maxCount) * 1.3 // 0.7x to 2x
                    const opacity = 0.5 + (w.count / maxCount) * 0.5
                    return (
                      <span
                        key={w.word}
                        className="inline-block px-2 py-1 rounded-md bg-muted hover:bg-muted/80 cursor-default transition-colors"
                        style={{
                          fontSize: `${scale}rem`,
                          opacity,
                        }}
                        title={`"${w.word}" — ${w.count} mentions`}
                      >
                        {w.word}
                        <span className="text-[10px] text-muted-foreground ml-1">{w.count}</span>
                      </span>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {data.totalResponses === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No feedback data yet</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Start collecting patient surveys to see feedback analytics here
                </p>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  )
}
