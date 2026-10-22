'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import {
  BarChart3,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Wrench,
} from 'lucide-react'

interface ReportData {
  complianceRate: number
  totalCycles: number
  passCount: number
  failCount: number
  pendingCount: number
  bioIndicatorRate: number
  chemIndicatorRate: number
  dueForMaintenance: Array<{
    id: string
    name: string
    category: string
    sterilizationCycleCount: number
    maxCycles: number
    percentUsed: number
  }>
  dueForRetirement: Array<{
    id: string
    name: string
    category: string
    sterilizationCycleCount: number
    maxCycles: number
  }>
  methodBreakdown: Array<{ method: string; count: number; passRate: number }>
}

export default function ComplianceReportsPage() {
  const t = useTranslations('sterilization.reports')
  const tMethod = useTranslations('sterilization.method')
  const tCategory = useTranslations('sterilization.category')
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<ReportData | null>(null)

  useEffect(() => {
    fetchReport()
  }, [])

  const fetchReport = async () => {
    setLoading(true)
    try {
      const [instrRes, logsRes] = await Promise.all([
        fetch('/api/sterilization/instruments'),
        fetch('/api/sterilization/logs?limit=500'),
      ])

      if (!instrRes.ok || !logsRes.ok) throw new Error('Failed to fetch data')

      const instrData = await instrRes.json()
      const logsData = await logsRes.json()
      const instruments = instrData.instruments || []
      const logs = logsData.logs || []

      // Compliance rate
      const passCount = logs.filter((l: any) => l.result === 'PASS').length
      const failCount = logs.filter((l: any) => l.result === 'FAIL').length
      const pendingCount = logs.filter((l: any) => l.result === 'PENDING').length
      const totalCycles = logs.length
      const complianceRate = totalCycles > 0 ? Math.round((passCount / totalCycles) * 1000) / 10 : 0

      // Indicator rates
      const bioCount = logs.filter((l: any) => l.biologicalIndicator).length
      const chemCount = logs.filter((l: any) => l.chemicalIndicator).length
      const bioIndicatorRate =
        totalCycles > 0 ? Math.round((bioCount / totalCycles) * 1000) / 10 : 0
      const chemIndicatorRate =
        totalCycles > 0 ? Math.round((chemCount / totalCycles) * 1000) / 10 : 0

      // Instruments due for maintenance (>= 80% of max cycles)
      const dueForMaintenance = instruments
        .filter(
          (i: any) =>
            i.maxCycles &&
            i.sterilizationCycleCount >= i.maxCycles * 0.8 &&
            i.sterilizationCycleCount < i.maxCycles
        )
        .map((i: any) => ({
          id: i.id,
          name: i.name,
          category: i.category,
          sterilizationCycleCount: i.sterilizationCycleCount,
          maxCycles: i.maxCycles,
          percentUsed: Math.round((i.sterilizationCycleCount / i.maxCycles) * 100),
        }))
        .sort((a: any, b: any) => b.percentUsed - a.percentUsed)

      // Instruments due for retirement (>= max cycles)
      const dueForRetirement = instruments
        .filter(
          (i: any) =>
            i.maxCycles && i.sterilizationCycleCount >= i.maxCycles && i.status !== 'RETIRED'
        )
        .map((i: any) => ({
          id: i.id,
          name: i.name,
          category: i.category,
          sterilizationCycleCount: i.sterilizationCycleCount,
          maxCycles: i.maxCycles,
        }))

      // Method breakdown
      const methodMap: Record<string, { total: number; pass: number }> = {}
      for (const l of logs) {
        if (!methodMap[l.method]) methodMap[l.method] = { total: 0, pass: 0 }
        methodMap[l.method].total++
        if (l.result === 'PASS') methodMap[l.method].pass++
      }
      const methodBreakdown = Object.entries(methodMap)
        .map(([method, data]) => ({
          method,
          count: data.total,
          passRate: data.total > 0 ? Math.round((data.pass / data.total) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.count - a.count)

      setReport({
        complianceRate,
        totalCycles,
        passCount,
        failCount,
        pendingCount,
        bioIndicatorRate,
        chemIndicatorRate,
        dueForMaintenance,
        dueForRetirement,
        methodBreakdown,
      })
    } catch (err: any) {
      toast({ title: t('errorTitle'), description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!report) return null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t('title')}</h2>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('complianceRate')}</CardTitle>
            <Shield className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${report.complianceRate >= 95 ? 'text-green-600' : report.complianceRate >= 80 ? 'text-yellow-600' : 'text-red-600'}`}
            >
              {report.complianceRate}%
            </div>
            <p className="text-xs text-muted-foreground">
              {t('passTotal', { pass: report.passCount, total: report.totalCycles })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('failedCycles')}</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{report.failCount}</div>
            <p className="text-xs text-muted-foreground">
              {t('pendingCount', { count: report.pendingCount })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('bioRate')}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{report.bioIndicatorRate}%</div>
            <p className="text-xs text-muted-foreground">{t('bioRateDesc')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('chemRate')}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{report.chemIndicatorRate}%</div>
            <p className="text-xs text-muted-foreground">{t('chemRateDesc')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Method Breakdown */}
      {report.methodBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {t('methodBreakdown')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colMethod')}</TableHead>
                  <TableHead className="text-right">{t('colTotalCycles')}</TableHead>
                  <TableHead className="text-right">{t('colPassRate')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.methodBreakdown.map((mb) => (
                  <TableRow key={mb.method}>
                    <TableCell className="font-medium">
                      {tMethod.has(mb.method) ? tMethod(mb.method) : mb.method}
                    </TableCell>
                    <TableCell className="text-right">{mb.count}</TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          mb.passRate >= 95
                            ? 'text-green-600'
                            : mb.passRate >= 80
                              ? 'text-yellow-600'
                              : 'text-red-600'
                        }
                      >
                        {mb.passRate}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Due for Retirement */}
      {report.dueForRetirement.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              {t('dueRetirement')}
            </CardTitle>
            <CardDescription>{t('dueRetirementDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colInstrument')}</TableHead>
                  <TableHead>{t('colCategory')}</TableHead>
                  <TableHead className="text-right">{t('colCyclesUsed')}</TableHead>
                  <TableHead className="text-right">{t('colMaxCycles')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.dueForRetirement.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.name}</TableCell>
                    <TableCell>
                      {tCategory.has(i.category) ? tCategory(i.category) : i.category}
                    </TableCell>
                    <TableCell className="text-right text-red-600 font-semibold">
                      {i.sterilizationCycleCount}
                    </TableCell>
                    <TableCell className="text-right">{i.maxCycles}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Due for Maintenance */}
      {report.dueForMaintenance.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700">
              <Wrench className="h-5 w-5" />
              {t('approachingMax')}
            </CardTitle>
            <CardDescription>{t('approachingMaxDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colInstrument')}</TableHead>
                  <TableHead>{t('colCategory')}</TableHead>
                  <TableHead className="text-right">{t('colCyclesUsed')}</TableHead>
                  <TableHead className="text-right">{t('colMaxCycles')}</TableHead>
                  <TableHead className="text-right">{t('colUsage')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.dueForMaintenance.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.name}</TableCell>
                    <TableCell>
                      {tCategory.has(i.category) ? tCategory(i.category) : i.category}
                    </TableCell>
                    <TableCell className="text-right">{i.sterilizationCycleCount}</TableCell>
                    <TableCell className="text-right">{i.maxCycles}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={i.percentUsed >= 90 ? 'destructive' : 'secondary'}>
                        {i.percentUsed}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {report.totalCycles === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">{t('noComplianceData')}</h3>
            <p className="text-muted-foreground text-sm mt-1">{t('noComplianceHint')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
