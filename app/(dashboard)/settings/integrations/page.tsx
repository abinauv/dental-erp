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

export default function IntegrationsPage() {
  const t = useTranslations('settings.integrations')
  const fmt = useClinicFormatters()
  const { toast } = useToast()
  const { confirm, ConfirmDialogComponent } = useConfirmDialog()
  const searchParams = useSearchParams()
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

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
    fetchCalendarStatus()
  }, [])

  const fetchCalendarStatus = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/integrations/google-calendar/sync')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setCalendarStatus(data)
    } catch {
      setCalendarStatus({ connected: false, integration: null })
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    try {
      setConnecting(true)
      const res = await fetch('/api/integrations/google-calendar/auth')
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
      setConnecting(false)
    }
  }

  const handleSync = async () => {
    try {
      setSyncing(true)
      const res = await fetch('/api/integrations/google-calendar/sync', {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: t('syncComplete'), description: data.message })
      fetchCalendarStatus()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('syncFailed'),
        description: err.message,
      })
    } finally {
      setSyncing(false)
    }
  }

  const handleDisconnect = async () => {
    const ok = await confirm({
      title: t('disconnectTitle'),
      description: t('disconnectDesc'),
      confirmLabel: t('disconnectConfirm'),
    })
    if (!ok) return
    try {
      setDisconnecting(true)
      const res = await fetch('/api/integrations/google-calendar/disconnect', {
        method: 'POST',
      })
      if (!res.ok) throw new Error(t('disconnectFailed'))
      toast({ title: t('disconnectedToast') })
      setCalendarStatus({ connected: false, integration: null })
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('error'), description: err.message })
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Google Calendar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle>Google Calendar</CardTitle>
                <CardDescription>{t('gcalDesc')}</CardDescription>
              </div>
            </div>
            {!loading && (
              <Badge variant={calendarStatus?.connected ? 'default' : 'secondary'}>
                {calendarStatus?.connected ? t('connected') : t('notConnected')}
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
          ) : calendarStatus?.connected ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">{t('calendarId')}</p>
                  <p className="font-medium">
                    {calendarStatus.integration?.calendarId || 'primary'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('connectedSince')}</p>
                  <p className="font-medium">
                    {calendarStatus.integration?.createdAt
                      ? fmt.formatDate(calendarStatus.integration.createdAt)
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('lastSync')}</p>
                  <p className="font-medium">
                    {calendarStatus.integration?.lastSyncAt
                      ? fmt.formatDateTime(calendarStatus.integration.lastSyncAt)
                      : t('never')}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('statusLabel')}</p>
                  <p className="font-medium flex items-center gap-1">
                    <Check className="h-4 w-4 text-green-600" />
                    {calendarStatus.integration?.syncEnabled ? t('syncEnabled') : t('syncDisabled')}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSync} disabled={syncing}>
                  {syncing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCcw className="h-4 w-4 mr-2" />
                  )}
                  {t('syncNow')}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="text-destructive"
                >
                  {disconnecting ? (
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
              <p className="text-sm text-muted-foreground">{t('connectIntro')}</p>
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                <p className="text-xs text-amber-800">{t('credentialsNote')}</p>
              </div>
              <Button onClick={handleConnect} disabled={connecting}>
                {connecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                {t('connectButton')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Future integrations placeholder */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted/50">
              <Calendar className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-muted-foreground">{t('outlookTitle')}</CardTitle>
              <CardDescription>{t('comingSoon')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('outlookDesc')}</p>
        </CardContent>
      </Card>
      {ConfirmDialogComponent}
    </div>
  )
}
