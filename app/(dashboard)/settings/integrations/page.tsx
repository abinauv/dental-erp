"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Calendar,
  Check,
  ExternalLink,
  Loader2,
  RefreshCcw,
  Unplug,
  AlertCircle,
} from "lucide-react"
import { useSearchParams } from "next/navigation"
import { format } from "date-fns"

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
    const success = searchParams.get("success")
    const error = searchParams.get("error")
    if (success === "connected") {
      toast({ title: "Google Calendar connected successfully" })
    } else if (error) {
      const messages: Record<string, string> = {
        denied: "Calendar access was denied",
        missing_params: "Missing parameters from Google",
        invalid_state: "Invalid session state",
        token_exchange: "Failed to exchange authentication token",
      }
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: messages[error] || "An error occurred",
      })
    }
  }, [searchParams, toast])

  useEffect(() => {
    fetchCalendarStatus()
  }, [])

  const fetchCalendarStatus = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/integrations/google-calendar/sync")
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
      const res = await fetch("/api/integrations/google-calendar/auth")
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to start connection")
      }
      const data = await res.json()
      window.location.href = data.authUrl
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message,
      })
      setConnecting(false)
    }
  }

  const handleSync = async () => {
    try {
      setSyncing(true)
      const res = await fetch("/api/integrations/google-calendar/sync", {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: "Sync Complete", description: data.message })
      fetchCalendarStatus()
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Sync Failed",
        description: err.message,
      })
    } finally {
      setSyncing(false)
    }
  }

  const handleDisconnect = async () => {
    const ok = await confirm({ title: "Disconnect Google Calendar?", description: "Your synced events won't be removed from Google.", confirmLabel: "Yes, proceed" }); if (!ok) return
    try {
      setDisconnecting(true)
      const res = await fetch("/api/integrations/google-calendar/disconnect", {
        method: "POST",
      })
      if (!res.ok) throw new Error("Failed to disconnect")
      toast({ title: "Google Calendar disconnected" })
      setCalendarStatus({ connected: false, integration: null })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-muted-foreground">
          Connect external services to enhance your workflow
        </p>
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
                <CardDescription>
                  Sync your appointments to Google Calendar automatically
                </CardDescription>
              </div>
            </div>
            {!loading && (
              <Badge variant={calendarStatus?.connected ? "default" : "secondary"}>
                {calendarStatus?.connected ? "Connected" : "Not Connected"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : calendarStatus?.connected ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Calendar ID</p>
                  <p className="font-medium">{calendarStatus.integration?.calendarId || "primary"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Connected Since</p>
                  <p className="font-medium">
                    {calendarStatus.integration?.createdAt
                      ? format(new Date(calendarStatus.integration.createdAt), "PPP")
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Sync</p>
                  <p className="font-medium">
                    {calendarStatus.integration?.lastSyncAt
                      ? format(new Date(calendarStatus.integration.lastSyncAt), "PPp")
                      : "Never"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-medium flex items-center gap-1">
                    <Check className="h-4 w-4 text-green-600" />
                    {calendarStatus.integration?.syncEnabled ? "Sync Enabled" : "Sync Disabled"}
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
                  Sync Now
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
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect your Google Calendar to automatically sync appointments. When you create
                or update appointments in the system, they'll appear on your Google Calendar.
              </p>
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Requires Google Calendar API credentials configured by the system administrator
                  (GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET environment variables).
                </p>
              </div>
              <Button onClick={handleConnect} disabled={connecting}>
                {connecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Connect Google Calendar
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
              <CardTitle className="text-muted-foreground">Microsoft Outlook Calendar</CardTitle>
              <CardDescription>Coming soon</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Outlook Calendar integration is planned for a future update.
          </p>
        </CardContent>
      </Card>
      {ConfirmDialogComponent}
    </div>
  )
}
