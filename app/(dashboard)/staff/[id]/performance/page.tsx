'use client'

import { useState, useEffect, use } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  ArrowLeft,
  Calendar,
  TrendingUp,
  Users,
  Stethoscope,
  IndianRupee,
  Clock,
  FileText,
  UserCheck,
  UserX,
  AlertCircle,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface PerformanceData {
  staff: {
    id: string
    employeeId: string
    name: string
    role: string
    specialization: string | null
  }
  period: {
    start: string
    end: string
  }
  appointments: {
    total: number
    completed: number
    cancelled: number
    noShow: number
    avgWaitTime: number
  }
  treatments: {
    total: number
    completed: number
    inProgress: number
    cancelled: number
  }
  revenue: {
    total: number
    averagePerTreatment: number
  }
  procedureBreakdown: Array<{
    category: string
    count: number
    revenue: number
  }>
  patientsTreated: number
  prescriptionsWritten: number
  attendance: {
    totalDays: number
    present: number
    absent: number
    late: number
    halfDay: number
    onLeave: number
  }
}

const categoryLabels: Record<string, string> = {
  PREVENTIVE: 'Preventive',
  RESTORATIVE: 'Restorative',
  ENDODONTIC: 'Endodontic',
  PERIODONTIC: 'Periodontic',
  PROSTHODONTIC: 'Prosthodontic',
  ORTHODONTIC: 'Orthodontic',
  ORAL_SURGERY: 'Oral Surgery',
  COSMETIC: 'Cosmetic',
  DIAGNOSTIC: 'Diagnostic',
  EMERGENCY: 'Emergency',
}

export default function PerformancePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const t = useTranslations('staff.performance')
  const tCategory = useTranslations('treatments.category')
  const fmt = useClinicFormatters()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PerformanceData | null>(null)

  // Date filters
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(1)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  const fetchPerformance = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        startDate,
        endDate,
      })

      const response = await fetch(`/api/staff/${resolvedParams.id}/performance?${params}`)
      if (!response.ok) {
        if (response.status === 404) {
          toast({
            variant: 'destructive',
            title: t('notFoundToast'),
            description: t('staffNotFound'),
          })
          router.push('/staff')
          return
        }
        throw new Error('Failed to fetch performance data')
      }

      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('Error fetching performance:', error)
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('fetchFailed'),
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPerformance()
  }, [resolvedParams.id, startDate, endDate])

  const formatCurrency = (amount: number) =>
    fmt.formatCurrency(amount, { maximumFractionDigits: 0 })

  const getCompletionRate = () => {
    if (!data || data.appointments.total === 0) return 0
    return Math.round((data.appointments.completed / data.appointments.total) * 100)
  }

  const getAttendanceRate = () => {
    if (!data || data.attendance.totalDays === 0) return 0
    return Math.round(
      ((data.attendance.present + data.attendance.late) / data.attendance.totalDays) * 100
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">{t('notAvailable')}</p>
        <Link href="/staff">
          <Button>{t('backToStaff')}</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <Link href={`/staff/${resolvedParams.id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-muted-foreground">
              {data.staff.specialization
                ? t('subtitleSpec', {
                    name: data.staff.name,
                    employeeId: data.staff.employeeId,
                    spec: data.staff.specialization,
                  })
                : t('subtitle', { name: data.staff.name, employeeId: data.staff.employeeId })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-[160px]"
          />
          <span className="text-muted-foreground">{t('to')}</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-[160px]"
          />
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('totalRevenue')}</p>
                <p className="text-2xl font-bold">{formatCurrency(data.revenue.total)}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <IndianRupee className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {t('avgPerTreatment', {
                amount: formatCurrency(data.revenue.averagePerTreatment),
              })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('patientsTreated')}</p>
                <p className="text-2xl font-bold">{data.patientsTreated}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">{t('uniquePatients')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('treatmentsDone')}</p>
                <p className="text-2xl font-bold">{data.treatments.completed}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                <Stethoscope className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {t('inProgressCount', { count: data.treatments.inProgress })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('prescriptions')}</p>
                <p className="text-2xl font-bold">{data.prescriptionsWritten}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                <FileText className="h-6 w-6 text-orange-600" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">{t('writtenThisPeriod')}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Appointments Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {t('appointments')}
            </CardTitle>
            <CardDescription>{t('appointmentsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('completionRate')}</span>
              <span className="text-sm font-medium">{getCompletionRate()}%</span>
            </div>
            <Progress value={getCompletionRate()} className="h-2" />

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">{t('total')}</p>
                <p className="text-xl font-bold">{data.appointments.total}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-green-600">{t('completed')}</p>
                <p className="text-xl font-bold text-green-700">{data.appointments.completed}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <p className="text-sm text-red-600">{t('cancelled')}</p>
                <p className="text-xl font-bold text-red-700">{data.appointments.cancelled}</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-600">{t('noShow')}</p>
                <p className="text-xl font-bold text-yellow-700">{data.appointments.noShow}</p>
              </div>
            </div>

            {data.appointments.avgWaitTime > 0 && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {t('avgWaitTime', { minutes: data.appointments.avgWaitTime })}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attendance Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              {t('attendance')}
            </CardTitle>
            <CardDescription>{t('attendanceDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('attendanceRate')}</span>
              <span className="text-sm font-medium">{getAttendanceRate()}%</span>
            </div>
            <Progress value={getAttendanceRate()} className="h-2" />

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <p className="text-sm text-green-600">{t('present')}</p>
                <p className="text-xl font-bold text-green-700">{data.attendance.present}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg text-center">
                <p className="text-sm text-red-600">{t('absent')}</p>
                <p className="text-xl font-bold text-red-700">{data.attendance.absent}</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg text-center">
                <p className="text-sm text-yellow-600">{t('late')}</p>
                <p className="text-xl font-bold text-yellow-700">{data.attendance.late}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-orange-50 rounded-lg text-center">
                <p className="text-sm text-orange-600">{t('halfDay')}</p>
                <p className="text-xl font-bold text-orange-700">{data.attendance.halfDay}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg text-center">
                <p className="text-sm text-blue-600">{t('onLeave')}</p>
                <p className="text-xl font-bold text-blue-700">{data.attendance.onLeave}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Procedure Breakdown */}
      {data.procedureBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {t('procedureBreakdown')}
            </CardTitle>
            <CardDescription>{t('procedureBreakdownDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.procedureBreakdown
                .sort((a, b) => b.revenue - a.revenue)
                .map((proc) => {
                  const maxRevenue = Math.max(...data.procedureBreakdown.map((p) => p.revenue))
                  const percentage = maxRevenue > 0 ? (proc.revenue / maxRevenue) * 100 : 0

                  return (
                    <div key={proc.category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {tCategory.has(proc.category)
                              ? tCategory(proc.category)
                              : categoryLabels[proc.category] || proc.category}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {t('proceduresCount', { count: proc.count })}
                          </span>
                        </div>
                        <span className="font-medium">{formatCurrency(proc.revenue)}</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
