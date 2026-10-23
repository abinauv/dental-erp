'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Crown, Gift, Share2, TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'

interface DashboardData {
  memberships: { active: number; total: number; revenue: number }
  referrals: { total: number; converted: number; rewarded: number; conversionRate: string }
  loyalty: { pointsInCirculation: number }
  retention: { totalActive: number; recentVisitors: number; rate: string; atRisk: number }
}

export default function CRMDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const t = useTranslations('crm.dashboard')
  const { formatCurrency, formatNumber } = useClinicFormatters()

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch('/api/crm/dashboard')
        if (!res.ok) throw new Error('Failed to fetch')
        setData(await res.json())
      } catch {
        toast({ title: t('loadError'), variant: 'destructive' })
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [t, toast])

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('stats.activeMemberships')}</CardTitle>
            <Crown className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.memberships.active || 0}</div>
            <p className="text-xs text-muted-foreground">
              {t('stats.revenue', { amount: formatCurrency(data?.memberships.revenue || 0) })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('stats.referralConversion')}</CardTitle>
            <Share2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.referrals.conversionRate || 0}%</div>
            <p className="text-xs text-muted-foreground">
              {t('stats.referralsConverted', {
                converted: data?.referrals.converted || 0,
                total: data?.referrals.total || 0,
              })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('stats.loyaltyPoints')}</CardTitle>
            <Gift className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(data?.loyalty.pointsInCirculation || 0)}
            </div>
            <p className="text-xs text-muted-foreground">{t('stats.pointsInCirculation')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('stats.patientRetention')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.retention.rate || 0}%</div>
            <p className="text-xs text-muted-foreground">
              {t('stats.visitedLast6Months', { count: data?.retention.recentVisitors || 0 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              {t('cards.memberships')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('cards.membershipsCount', {
                active: data?.memberships.active || 0,
                total: data?.memberships.total || 0,
              })}
            </p>
            <Link href="/crm/memberships">
              <Button variant="outline" className="w-full">
                {t('cards.managePlans')} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-purple-500" />
              {t('cards.loyaltyProgram')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('cards.pointsInCirculation', {
                points: formatNumber(data?.loyalty.pointsInCirculation || 0),
              })}
            </p>
            <Link href="/crm/loyalty">
              <Button variant="outline" className="w-full">
                {t('cards.viewTransactions')} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-blue-500" />
              {t('cards.referrals')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('cards.referralsSummary', {
                total: data?.referrals.total || 0,
                rate: data?.referrals.conversionRate || 0,
              })}
            </p>
            <Link href="/crm/referrals">
              <Button variant="outline" className="w-full">
                {t('cards.trackReferrals')} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* At Risk Patients Alert */}
      {(data?.retention.atRisk || 0) > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              {t('atRisk.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-700">
              {t('atRisk.description', { count: data?.retention.atRisk || 0 })}
            </p>
            <Link href="/crm/segments">
              <Button
                variant="outline"
                className="mt-3 border-amber-300 text-amber-700 hover:bg-amber-100"
              >
                {t('atRisk.viewSegments')} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
