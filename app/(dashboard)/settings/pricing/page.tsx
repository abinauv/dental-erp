"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  Users,
  Loader2,
  Sparkles,
  AlertCircle,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface PricingSuggestion {
  type: string
  description: string
  dayOrTime: string
  discountPercent?: number
  premiumPercent?: number
  rationale: string
  estimatedRevenueImpact: string
  priority: string
}

interface ProcedureDemand {
  procedure: string
  bookingRate: number
  avgWaitDays: number
  suggestion: string
}

interface DoctorUtilization {
  doctorName: string
  utilization: number
  suggestion: string
}

interface PricingData {
  peakAnalysis?: {
    busiestDays: string[]
    quietestDays: string[]
    busiestHours: string[]
    quietestHours: string[]
    averageUtilization: number
    peakUtilization: number
  }
  pricingSuggestions?: PricingSuggestion[]
  procedureDemand?: ProcedureDemand[]
  doctorUtilization?: DoctorUtilization[]
  summary?: {
    overallDemand: string
    revenueOpportunity: number
    topRecommendation: string
  }
}

export default function PricingSuggestionsPage() {
  const [data, setData] = useState<PricingData | null>(null)
  const [loading, setLoading] = useState(false)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const { toast } = useToast()

  const generateSuggestions = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/ai/pricing-suggestions")
      if (!res.ok) throw new Error("Failed to generate suggestions")
      const result = await res.json()
      setData(result.suggestions)
      setGeneratedAt(result.generatedAt)
      toast({ title: "Success", description: "Pricing analysis generated" })
    } catch {
      toast({ title: "Error", description: "Failed to generate pricing suggestions", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const priorityColor = (p: string) => {
    switch (p) {
      case "HIGH": return "bg-red-100 text-red-700"
      case "MEDIUM": return "bg-amber-100 text-amber-700"
      default: return "bg-green-100 text-green-700"
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dynamic Pricing Advisor</h1>
          <p className="text-muted-foreground">
            AI-powered pricing recommendations based on demand patterns
          </p>
        </div>
        <Button onClick={generateSuggestions} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          {loading ? "Analyzing..." : "Generate Analysis"}
        </Button>
      </div>

      {/* Advisory notice */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-800">Advisory Only</p>
            <p className="text-blue-700">
              These are AI-generated recommendations. No pricing changes are applied automatically.
              Review each suggestion and implement manually if appropriate.
            </p>
          </div>
        </CardContent>
      </Card>

      {!data && !loading && (
        <Card>
          <CardContent className="p-12 text-center">
            <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No Analysis Generated</p>
            <p className="text-muted-foreground mb-4">
              Click &quot;Generate Analysis&quot; to get AI-powered pricing recommendations
              based on your clinic&apos;s appointment and revenue data.
            </p>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {/* Summary */}
          {data.summary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                    <p className="text-sm text-muted-foreground">Overall Demand</p>
                  </div>
                  <p className="text-2xl font-bold">{data.summary.overallDemand}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-5 w-5 text-green-500" />
                    <p className="text-sm text-muted-foreground">Revenue Opportunity</p>
                  </div>
                  <p className="text-2xl font-bold">
                    {"\u20B9"}{data.summary.revenueOpportunity?.toLocaleString()}/mo
                  </p>
                </CardContent>
              </Card>
              <Card className="md:col-span-1">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    <p className="text-sm text-muted-foreground">Top Recommendation</p>
                  </div>
                  <p className="text-sm">{data.summary.topRecommendation}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Peak Analysis */}
          {data.peakAnalysis && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-5 w-5" /> Peak & Off-Peak Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Busiest Days</p>
                    <div className="flex flex-wrap gap-1">
                      {data.peakAnalysis.busiestDays?.map((d) => (
                        <Badge key={d} className="bg-red-100 text-red-700">{d}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Quietest Days</p>
                    <div className="flex flex-wrap gap-1">
                      {data.peakAnalysis.quietestDays?.map((d) => (
                        <Badge key={d} className="bg-green-100 text-green-700">{d}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Peak Hours</p>
                    <div className="flex flex-wrap gap-1">
                      {data.peakAnalysis.busiestHours?.map((h) => (
                        <Badge key={h} variant="outline">{h}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Off-Peak Hours</p>
                    <div className="flex flex-wrap gap-1">
                      {data.peakAnalysis.quietestHours?.map((h) => (
                        <Badge key={h} variant="outline">{h}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex gap-8">
                  <div>
                    <p className="text-xs text-muted-foreground">Avg Utilization</p>
                    <p className="text-lg font-bold">{data.peakAnalysis.averageUtilization}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Peak Utilization</p>
                    <p className="text-lg font-bold">{data.peakAnalysis.peakUtilization}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pricing Suggestions */}
          {data.pricingSuggestions && data.pricingSuggestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <DollarSign className="h-5 w-5" /> Pricing Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.pricingSuggestions.map((s, i) => (
                    <div key={i} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {s.type === "OFF_PEAK_DISCOUNT" ? (
                            <TrendingDown className="h-5 w-5 text-green-500" />
                          ) : (
                            <TrendingUp className="h-5 w-5 text-blue-500" />
                          )}
                          <div>
                            <p className="font-medium">{s.description}</p>
                            <p className="text-sm text-muted-foreground">{s.dayOrTime}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={priorityColor(s.priority)}>{s.priority}</Badge>
                          <Badge variant="outline">
                            {s.discountPercent
                              ? `-${s.discountPercent}%`
                              : s.premiumPercent
                              ? `+${s.premiumPercent}%`
                              : ""}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">{s.rationale}</p>
                      <p className="text-sm font-medium text-green-600">
                        Est. Impact: {s.estimatedRevenueImpact}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Doctor Utilization */}
          {data.doctorUtilization && data.doctorUtilization.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-5 w-5" /> Doctor Utilization
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.doctorUtilization.map((d, i) => (
                    <div key={i} className="flex items-center justify-between border-b pb-3 last:border-0">
                      <div>
                        <p className="font-medium">{d.doctorName}</p>
                        <p className="text-sm text-muted-foreground">{d.suggestion}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{d.utilization}%</p>
                        <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              d.utilization > 85 ? "bg-red-500" : d.utilization > 60 ? "bg-amber-500" : "bg-green-500"
                            }`}
                            style={{ width: `${d.utilization}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Procedure Demand */}
          {data.procedureDemand && data.procedureDemand.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Procedure Demand</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.procedureDemand.map((p, i) => (
                    <div key={i} className="flex items-center justify-between border-b pb-3 last:border-0">
                      <div>
                        <p className="font-medium">{p.procedure}</p>
                        <p className="text-sm text-muted-foreground">{p.suggestion}</p>
                      </div>
                      <div className="text-right text-sm">
                        <p>Booking: <span className="font-medium">{p.bookingRate}%</span></p>
                        <p className="text-muted-foreground">Avg wait: {p.avgWaitDays}d</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {generatedAt && (
            <p className="text-xs text-muted-foreground text-center">
              Generated at {new Date(generatedAt).toLocaleString()}
            </p>
          )}
        </>
      )}
    </div>
  )
}
