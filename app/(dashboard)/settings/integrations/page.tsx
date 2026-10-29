'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Calendar,
  Check,
  ExternalLink,
  Loader2,
  RefreshCcw,
  Unplug,
  AlertCircle,
} from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'

interface CalendarStatus {
  connected: boolean
  integration: {
    id: string
    provider: string
    calendarId: string | null
    syncEnabled: boolean
    lastSyncAt: string | null
    createdAt: string
  } | null
}

type ProviderKey = 'google' | 'outlook'

interface ProviderConfig {
  key: ProviderKey
  name: string
  base: string
  descKey: 'gcalDesc' | 'outlookDesc'
  envVars: string
  iconBg: string
  iconColor: string
}

// Both calendar providers share one backend shape (CalendarIntegration rows keyed
// by provider) and one set of REST routes, so a single card renders each from the
// same config.
const PROVIDERS: ProviderConfig[] = [
  {
    key: 'google',
    name: 'Google Calendar',
    base: '/api/integrations/google-calendar',
    descKey: 'gcalDesc',
    envVars: 'GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    key: 'outlook',
    name: 'Outlook Calendar',
    base: '/api/integrations/outlook-calendar',
    descKey: 'outlookDesc',
    envVars: 'OUTLOOK_CALENDAR_CLIENT_ID and OUTLOOK_CALENDAR_CLIENT_SECRET',
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-700',
  },
]

export default function IntegrationsPage() {
  const t = useTranslations('settings.integrations')
  const fmt = useClinicFormatters()
  const { toast } = useToast()
  const { confirm, ConfirmDialogComponent } = useConfirmDialog()
  const searchParams = useSearchParams()
  const [statuses, setStatuses] = useState<Record<ProviderKey, CalendarStatus | null>>({
    google: null,
    outlook: null,
  })
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState<ProviderKey | null>(null)
  const [syncing, setSyncing] = useState<ProviderKey | null>(null)
  const [disconnecting, setDisconnecting] = useState<ProviderKey | null>(null)

  // Show success/error from OAuth callback
  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    if (success === 'connected') {
      toast({ title: t('connectedToast') })
    } else if (error) {
      const messages: Record<string, string> = {
        denied: t('errDenied'),
        missing_params: t('errMissingParams'),
        invalid_state: t('errInvalidState'),
        token_exchange: t('errTokenExchange'),
      }
      toast({
        variant: 'destructive',
        title: t('connectionFailed'),
        description: messages[error] || t('genericError'),
      })
    }
  }, [searchParams, toast, t])

  useEffect(() => {
    fetchStatuses()
  }, [])

  const fetchStatuses = async () => {
    try {
      setLoading(true)
      const results = await Promise.all(
        PROVIDERS.map(async (p) => {
          try {
            const res = await fetch(`${p.base}/sync`)
            if (!res.ok) throw new Error()
            return [p.key, (await res.json()) as CalendarStatus] as const
          } catch {
            return [p.key, { connected: false, integration: null }] as const
          }
        })
      )
      setStatuses(Object.fromEntries(results) as Record<ProviderKey, CalendarStatus>)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async (p: ProviderConfig) => {
    try {
      setConnecting(p.key)
      const res = await fetch(`${p.base}/auth`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || t('startConnectionFailed'))
      }
      const data = await res.json()
      window.location.href = data.authUrl
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: err.message,
      })
      setConnecting(null)
    }
  }

  const handleSync = async (p: ProviderConfig) => {
    try {
      setSyncing(p.key)
      const res = await fetch(`${p.base}/sync`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: t('syncComplete'), description: data.message })
      fetchStatuses()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('syncFailed'),
        description: err.message,
      })
    } finally {
      setSyncing(null)
    }
  }

  const handleDisconnect = async (p: ProviderConfig) => {
    const ok = await confirm({
      title: t('disconnectTitle', { provider: p.name }),
      description: t('disconnectDesc', { provider: p.name }),
      confirmLabel: t('disconnectConfirm'),
    })
    if (!ok) return
    try {
      setDisconnecting(p.key)
      const res = await fetch(`${p.base}/disconnect`, { method: 'POST' })
      if (!res.ok) throw new Error(t('disconnectFailed'))
      toast({ title: t('disconnectedToast', { provider: p.name }) })
      setStatuses((prev) => ({ ...prev, [p.key]: { connected: false, integration: null } }))
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('error'), description: err.message })
    } finally {
      setDisconnecting(null)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      {PROVIDERS.map((p) => {
        const status = statuses[p.key]
        return (
          <Card key={p.key}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-lg ${p.iconBg}`}
                  >
                    <Calendar className={`h-6 w-6 ${p.iconColor}`} />
                  </div>
                  <div>
                    <CardTitle>{p.name}</CardTitle>
                    <CardDescription>{t(p.descKey)}</CardDescription>
                  </div>
                </div>
                {!loading && (
                  <Badge variant={status?.connected ? 'default' : 'secondary'}>
                    {status?.connected ? t('connected') : t('notConnected')}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('loading')}
                </div>
              ) : status?.connected ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">{t('calendarId')}</p>
                      <p className="font-medium">{status.integration?.calendarId || 'primary'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('connectedSince')}</p>
                      <p className="font-medium">
                        {status.integration?.createdAt
                          ? fmt.formatDate(status.integration.createdAt)
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('lastSync')}</p>
                      <p className="font-medium">
                        {status.integration?.lastSyncAt
                          ? fmt.formatDateTime(status.integration.lastSyncAt)
                          : t('never')}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('statusLabel')}</p>
                      <p className="font-medium flex items-center gap-1">
                        <Check className="h-4 w-4 text-green-600" />
                        {status.integration?.syncEnabled ? t('syncEnabled') : t('syncDisabled')}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={() => handleSync(p)} disabled={syncing === p.key}>
                      {syncing === p.key ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCcw className="h-4 w-4 mr-2" />
                      )}
                      {t('syncNow')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleDisconnect(p)}
                      disabled={disconnecting === p.key}
                      className="text-destructive"
                    >
                      {disconnecting === p.key ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Unplug className="h-4 w-4 mr-2" />
                      )}
                      {t('disconnect')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {t('connectIntro', { provider: p.name })}
                  </p>
                  <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                    <p className="text-xs text-amber-800">
                      {t('credentialsNote', { envVars: p.envVars })}
                    </p>
                  </div>
                  <Button onClick={() => handleConnect(p)} disabled={connecting === p.key}>
                    {connecting === p.key ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    {t('connectButton', { provider: p.name })}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
      {ConfirmDialogComponent}
    </div>
  )
}
