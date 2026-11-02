'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { CardDescription } from '@/components/ui/card'
import {
  UserPlus,
  Users,
  Crown,
  AlertTriangle,
  UserX,
  TrendingUp,
  Brain,
  Loader2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'

interface PatientInfo {
  id: string
  patientId: string
  firstName: string
  lastName: string
  phone: string
  lastVisit: string | null
  totalSpend: number
}

interface Segment {
  count: number
  patients: PatientInfo[]
}

interface SegmentData {
  segments: {
    new: Segment
    active: Segment
    loyal: Segment
    atRisk: Segment
    lost: Segment
    highValue: Segment
  }
  totalPatients: number
}

// Display labels and descriptions live in the `crm.segments.map` catalogue,
// resolved by key at render; only the icon and colours stay in code.
const SEGMENT_CONFIG: Record<string, { icon: any; color: string; bgColor: string }> = {
  new: { icon: UserPlus, color: 'text-cyan-700', bgColor: 'bg-cyan-50 border-cyan-200' },
  active: { icon: Users, color: 'text-green-700', bgColor: 'bg-green-50 border-green-200' },
  loyal: { icon: Crown, color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200' },
  atRisk: {
    icon: AlertTriangle,
    color: 'text-orange-700',
    bgColor: 'bg-orange-50 border-orange-200',
  },
  lost: { icon: UserX, color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
  highValue: {
    icon: TrendingUp,
    color: 'text-purple-700',
    bgColor: 'bg-purple-50 border-purple-200',
  },
}

export default function SegmentsPage() {
  const [data, setData] = useState<SegmentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('new')
  const { toast } = useToast()
  const t = useTranslations('crm.segments')
  const { formatCurrency, formatDate } = useClinicFormatters()

  // AI Segmentation
  const [aiData, setAiData] = useState<any>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const fetchAiSegments = async () => {
    try {
      setAiLoading(true)
      const res = await fetch('/api/ai/patient-segments')
      if (!res.ok) throw new Error('Failed')
      setAiData(await res.json())
    } catch {
      toast({ title: t('toast.aiLoadError'), variant: 'destructive' })
    } finally {
      setAiLoading(false)
    }
  }

  useEffect(() => {
    async function fetchSegments() {
      try {
        const res = await fetch('/api/crm/segments')
        if (!res.ok) throw new Error('Failed to fetch')
        setData(await res.json())
      } catch {
        toast({ title: t('toast.loadError'), variant: 'destructive' })
      } finally {
        setLoading(false)
      }
    }
    fetchSegments()
  }, [t, toast])

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const segments = data?.segments

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('totalPatients', { count: data?.totalPatients || 0 })}
          </p>
        </div>
        <Button variant="outline" onClick={fetchAiSegments} disabled={aiLoading}>
          {aiLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Brain className="h-4 w-4 mr-2" />
          )}
          {t('aiButton')}
        </Button>
      </div>

      {/* Segment Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Object.entries(SEGMENT_CONFIG).map(([key, config]) => {
          const segment = segments?.[key as keyof typeof segments]
          const Icon = config.icon
          return (
            <Card
              key={key}
              className={`cursor-pointer transition-shadow hover:shadow-md ${activeTab === key ? config.bgColor : ''}`}
              onClick={() => setActiveTab(key)}
            >
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`h-4 w-4 ${config.color}`} />
                  <span className="text-xs font-medium truncate">{t(`map.${key}.label`)}</span>
                </div>
                <div className="text-2xl font-bold">{segment?.count || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">{t(`map.${key}.description`)}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Segment Detail Table */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-6 w-full">
          {Object.entries(SEGMENT_CONFIG).map(([key]) => (
            <TabsTrigger key={key} value={key} className="text-xs">
              {t(`map.${key}.label`)}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(SEGMENT_CONFIG).map(([key, config]) => {
          const segment = segments?.[key as keyof typeof segments]
          return (
            <TabsContent key={key} value={key}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <config.icon className={`h-5 w-5 ${config.color}`} />
                    {t(`map.${key}.label`)}
                    <Badge variant="outline">{segment?.count || 0}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!segment || segment.patients.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">{t('emptySegment')}</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('col.patientId')}</TableHead>
                          <TableHead>{t('col.name')}</TableHead>
                          <TableHead>{t('col.phone')}</TableHead>
                          <TableHead>{t('col.lastVisit')}</TableHead>
                          <TableHead className="text-right">{t('col.totalSpend')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {segment.patients.map((patient) => (
                          <TableRow key={patient.id}>
                            <TableCell className="font-mono text-sm">{patient.patientId}</TableCell>
                            <TableCell className="font-medium">
                              {patient.firstName} {patient.lastName}
                            </TableCell>
                            <TableCell>{patient.phone}</TableCell>
                            <TableCell>
                              {patient.lastVisit ? formatDate(patient.lastVisit) : t('never')}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(patient.totalSpend)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )
        })}
      </Tabs>

      {/* AI Churn Analysis */}
      {aiData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              {t('ai.title')}
            </CardTitle>
            <CardDescription>
              {t('ai.subtitle', { risk: aiData.summary?.avgChurnRisk || 0 })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* AI Segment Summary */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {[
                  { key: 'vip', count: aiData.summary?.vip, color: 'text-purple-700 bg-purple-50' },
                  {
                    key: 'loyal',
                    count: aiData.summary?.loyal,
                    color: 'text-amber-700 bg-amber-50',
                  },
                  {
                    key: 'regular',
                    count: aiData.summary?.regular,
                    color: 'text-green-700 bg-green-50',
                  },
                  {
                    key: 'atRisk',
                    count: aiData.summary?.atRisk,
                    color: 'text-orange-700 bg-orange-50',
                  },
                  {
                    key: 'churning',
                    count: aiData.summary?.churning,
                    color: 'text-red-700 bg-red-50',
                  },
                  { key: 'new', count: aiData.summary?.new, color: 'text-cyan-700 bg-cyan-50' },
                ].map((s) => (
                  <div key={s.key} className={`text-center p-2 rounded-lg ${s.color}`}>
                    <div className="text-xl font-bold">{s.count || 0}</div>
                    <div className="text-xs">{t(`ai.segment.${s.key}`)}</div>
                  </div>
                ))}
              </div>

              {/* Retention actions */}
              {aiData.summary?.topRetentionActions?.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-blue-700 mb-1">
                    {t('ai.topRetentionActions')}
                  </p>
                  {aiData.summary.topRetentionActions.map((a: string, i: number) => (
                    <p key={i} className="text-xs text-blue-600">
                      • {a}
                    </p>
                  ))}
                </div>
              )}

              {/* High churn risk patients */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('ai.colPatient')}</TableHead>
                    <TableHead>{t('ai.colSegment')}</TableHead>
                    <TableHead>{t('ai.colRecency')}</TableHead>
                    <TableHead>{t('ai.colFrequency')}</TableHead>
                    <TableHead>{t('ai.colSpend')}</TableHead>
                    <TableHead>{t('ai.colChurnRisk')}</TableHead>
                    <TableHead>{t('ai.colRecommendation')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(aiData.patients || [])
                    .filter((p: any) => p.churnLevel === 'HIGH' || p.churnLevel === 'MEDIUM')
                    .sort((a: any, b: any) => b.churnRisk - a.churnRisk)
                    .slice(0, 20)
                    .map((p: any) => (
                      <TableRow key={p.patientId}>
                        <TableCell>
                          <div className="font-medium">{p.name || p.displayId}</div>
                          {p.phone && (
                            <div className="text-xs text-muted-foreground">{p.phone}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {p.segment}
                          </Badge>
                        </TableCell>
                        <TableCell>{p.rfm?.recency || t('ai.na')}</TableCell>
                        <TableCell>{p.rfm?.frequency || 0}</TableCell>
                        <TableCell>{formatCurrency(p.rfm?.monetary || 0)}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              p.churnLevel === 'HIGH'
                                ? 'bg-red-100 text-red-700 border-0'
                                : p.churnLevel === 'MEDIUM'
                                  ? 'bg-amber-100 text-amber-700 border-0'
                                  : 'bg-green-100 text-green-700 border-0'
                            }
                          >
                            {p.churnRisk}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">
                          {p.recommendation}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
