'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Crown, Building2, Zap, Server } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'
import { cn } from '@/lib/utils'

type Plan = 'FREE' | 'PROFESSIONAL' | 'ENTERPRISE' | 'SELF_HOSTED'

type HospitalData = {
  name: string
  plan: Plan
  maxPatients: number
  maxStaff: number
  maxStorageMB: number
  currentPatients: number
  currentStaff: number
  currentStorageMB: number
}

// Static plan configuration. Display copy (name, description, features) lives in
// the message catalogue under settings.subscription.plans.<id>; `price` is a
// numeric amount formatted through the clinic formatter, or null for the
// quote-based Enterprise plan.
const planConfigs = [
  { id: 'FREE' as Plan, price: 0, icon: Building2 },
  { id: 'PROFESSIONAL' as Plan, price: 2999, icon: Zap, popular: true },
  { id: 'ENTERPRISE' as Plan, price: null, icon: Crown },
  { id: 'SELF_HOSTED' as Plan, price: 49999, icon: Server, oneTime: true },
]

export default function SubscriptionPage() {
  const t = useTranslations('settings.subscription')
  const fmt = useClinicFormatters()
  const { toast } = useToast()
  const [hospitalData, setHospitalData] = useState<HospitalData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchHospitalData()
  }, [])

  const fetchHospitalData = async () => {
    try {
      const response = await fetch('/api/settings/subscription')
      if (response.ok) {
        const data = await response.json()
        setHospitalData(data)
      }
    } catch {
      toast({
        variant: 'destructive',
        title: t('errorTitle'),
        description: t('loadFailed'),
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpgrade = async (planId: Plan) => {
    // In production, this would redirect to a payment page
    toast({
      title: t('upgradeRequested'),
      description: t('upgradeRequestedDesc'),
    })
  }

  const getUsagePercentage = (current: number, max: number) => {
    if (max === -1) return 0 // Unlimited
    return Math.min((current / max) * 100, 100)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Current Plan Usage */}
      {hospitalData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t('currentPlanTitle')}</CardTitle>
                <CardDescription>{t('currentPlanDesc')}</CardDescription>
              </div>
              <Badge
                variant={hospitalData.plan === 'FREE' ? 'secondary' : 'default'}
                className="text-sm"
              >
                {t(`planBadge.${hospitalData.plan}`)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Patients Usage */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t('patients')}</span>
                <span className="text-muted-foreground">
                  {hospitalData.currentPatients} /{' '}
                  {hospitalData.maxPatients === -1 ? t('unlimited') : hospitalData.maxPatients}
                </span>
              </div>
              {hospitalData.maxPatients !== -1 && (
                <Progress
                  value={getUsagePercentage(hospitalData.currentPatients, hospitalData.maxPatients)}
                  className={cn(
                    getUsagePercentage(hospitalData.currentPatients, hospitalData.maxPatients) > 80
                      ? '[&>div]:bg-destructive'
                      : ''
                  )}
                />
              )}
            </div>

            {/* Staff Usage */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t('staffMembers')}</span>
                <span className="text-muted-foreground">
                  {hospitalData.currentStaff} /{' '}
                  {hospitalData.maxStaff === -1 ? t('unlimited') : hospitalData.maxStaff}
                </span>
              </div>
              {hospitalData.maxStaff !== -1 && (
                <Progress
                  value={getUsagePercentage(hospitalData.currentStaff, hospitalData.maxStaff)}
                  className={cn(
                    getUsagePercentage(hospitalData.currentStaff, hospitalData.maxStaff) > 80
                      ? '[&>div]:bg-destructive'
                      : ''
                  )}
                />
              )}
            </div>

            {/* Storage Usage */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t('storage')}</span>
                <span className="text-muted-foreground">
                  {hospitalData.currentStorageMB} MB /{' '}
                  {hospitalData.maxStorageMB === -1
                    ? t('unlimited')
                    : `${hospitalData.maxStorageMB} MB`}
                </span>
              </div>
              {hospitalData.maxStorageMB !== -1 && (
                <Progress
                  value={getUsagePercentage(
                    hospitalData.currentStorageMB,
                    hospitalData.maxStorageMB
                  )}
                  className={cn(
                    getUsagePercentage(hospitalData.currentStorageMB, hospitalData.maxStorageMB) >
                      80
                      ? '[&>div]:bg-destructive'
                      : ''
                  )}
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Plans */}
      <div>
        <h2 className="text-xl font-semibold mb-4">{t('availablePlans')}</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {planConfigs.map((plan) => {
            const Icon = plan.icon
            const isCurrent = hospitalData?.plan === plan.id
            const isCustom = plan.price === null
            const features = t.raw(`plans.${plan.id}.features`) as string[]

            return (
              <Card
                key={plan.id}
                className={cn(
                  'relative',
                  plan.popular && 'border-primary shadow-md',
                  isCurrent && 'bg-muted/50'
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary">{t('mostPopular')}</Badge>
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg',
                        plan.popular ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{t(`plans.${plan.id}.name`)}</CardTitle>
                      {isCurrent && (
                        <Badge variant="outline" className="text-xs">
                          {t('current')}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardDescription>{t(`plans.${plan.id}.description`)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <span className="text-3xl font-bold">
                      {isCustom ? t('custom') : fmt.formatCurrency(plan.price)}
                    </span>
                    {plan.oneTime ? (
                      <span className="text-muted-foreground"> {t('oneTime')}</span>
                    ) : !isCustom && plan.price !== 0 ? (
                      <span className="text-muted-foreground">{t('perMonth')}</span>
                    ) : null}
                  </div>
                  <ul className="space-y-2">
                    {features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={isCurrent ? 'outline' : plan.popular ? 'default' : 'outline'}
                    disabled={isCurrent}
                    onClick={() => handleUpgrade(plan.id)}
                  >
                    {isCurrent ? t('currentPlan') : isCustom ? t('contactSales') : t('upgrade')}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
