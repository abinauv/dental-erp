'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Calendar,
  CreditCard,
  ClipboardList,
  Activity,
  ArrowRight,
  Clock,
  User,
  CalendarPlus,
} from 'lucide-react'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'

interface DashboardData {
  upcomingAppointments: Array<{
    id: string
    appointmentNo: string
    scheduledDate: string
    scheduledTime: string
    appointmentType: string
    status: string
    doctor: { firstName: string; lastName: string; specialization: string | null }
  }>
  recentTreatments: Array<{
    id: string
    treatmentNo: string
    createdAt: string
    status: string
    procedure: { name: string; code: string | null }
    doctor: { firstName: string; lastName: string }
  }>
  outstandingInvoices: Array<{
    id: string
    invoiceNo: string
    totalAmount: number | string
    balanceAmount: number | string
    status: string
    dueDate: string | null
  }>
  stats: {
    totalVisits: number
    upcomingCount: number
    totalOutstanding: number
    outstandingCount: number
  }
}

export default function PatientDashboard() {
  const t = useTranslations('portal.dashboard')
  const tAptType = useTranslations('appointments.type')
  const tInvStatus = useTranslations('billing.status')
  const tTxStatus = useTranslations('treatments.status')
  const { formatCurrency, formatDate } = useClinicFormatters()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/patient-portal/dashboard')
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Link href="/portal/book">
          <Button>
            <CalendarPlus className="h-4 w-4 mr-2" />
            {t('bookAppointment')}
          </Button>
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-100">
                <Calendar className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.stats.upcomingCount}</p>
                <p className="text-xs text-muted-foreground">{t('upcoming')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-green-100">
                <Activity className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.stats.totalVisits}</p>
                <p className="text-xs text-muted-foreground">{t('totalVisits')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-orange-100">
                <CreditCard className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.stats.outstandingCount}</p>
                <p className="text-xs text-muted-foreground">{t('pendingBills')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-red-100">
                <CreditCard className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(data.stats.totalOutstanding)}</p>
                <p className="text-xs text-muted-foreground">{t('balanceDue')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Upcoming Appointments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">{t('upcomingAppointments')}</CardTitle>
            <Link
              href="/portal/appointments"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              {t('viewAll')} <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {data.upcomingAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t('noUpcoming')}</p>
            ) : (
              <div className="space-y-3">
                {data.upcomingAppointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {t('aptWhen', {
                            date: formatDate(apt.scheduledDate),
                            time: apt.scheduledTime,
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {t('doctorPrefix', {
                            name: `${apt.doctor.firstName} ${apt.doctor.lastName}`,
                          })}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {tAptType.has(apt.appointmentType)
                        ? tAptType(apt.appointmentType)
                        : apt.appointmentType.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Outstanding Bills */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">{t('outstandingBills')}</CardTitle>
            <Link
              href="/portal/bills"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              {t('viewAll')} <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {data.outstandingInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t('allPaid')}</p>
            ) : (
              <div className="space-y-3">
                {data.outstandingInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div>
                      <p className="text-sm font-medium">{inv.invoiceNo}</p>
                      {inv.dueDate && (
                        <p className="text-xs text-muted-foreground">
                          {t('due', { date: formatDate(inv.dueDate) })}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(inv.balanceAmount)}</p>
                      <Badge
                        variant={inv.status === 'PARTIALLY_PAID' ? 'secondary' : 'destructive'}
                        className="text-xs"
                      >
                        {tInvStatus.has(inv.status)
                          ? tInvStatus(inv.status)
                          : inv.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Treatments */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">{t('recentTreatments')}</CardTitle>
            <Link
              href="/portal/records"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              {t('viewAll')} <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {data.recentTreatments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t('noTreatments')}</p>
            ) : (
              <div className="space-y-3">
                {data.recentTreatments.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{tx.procedure.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('treatmentMeta', {
                          name: `${tx.doctor.firstName} ${tx.doctor.lastName}`,
                          date: formatDate(tx.createdAt),
                        })}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {tTxStatus.has(tx.status) ? tTxStatus(tx.status) : tx.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
