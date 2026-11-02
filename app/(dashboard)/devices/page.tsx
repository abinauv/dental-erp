'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Wifi,
  WifiOff,
  AlertTriangle,
  Wrench,
  Plus,
  Trash2,
  RefreshCw,
  Monitor,
  Activity,
  Cpu,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'

interface Device {
  id: string
  name: string
  type: string
  serialNumber: string | null
  location: string | null
  status: string
  lastPingAt: string | null
  ipAddress: string | null
  firmwareVersion: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  dataLogs: { id: string; data: Record<string, unknown>; eventType: string; timestamp: string }[]
}

interface DeviceSummary {
  total: number
  online: number
  offline: number
  error: number
  maintenance: number
}

// Device type option values; labels come from the catalogue (devices.type.*).
const DEVICE_TYPE_VALUES = [
  'DENTAL_CHAIR',
  'PULSE_OXIMETER',
  'BP_MONITOR',
  'AUTOCLAVE',
  'XRAY',
  'COMPRESSOR',
  'SENSOR',
  'OTHER',
]

// Status icon + colour; the label comes from the catalogue (devices.status.*).
const STATUS_CONFIG: Record<string, { color: string; icon: typeof Wifi }> = {
  ONLINE: { color: 'bg-green-100 text-green-700', icon: Wifi },
  OFFLINE: { color: 'bg-muted text-muted-foreground', icon: WifiOff },
  ERROR: { color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  MAINTENANCE: { color: 'bg-amber-100 text-amber-700', icon: Wrench },
}

export default function DevicesPage() {
  const t = useTranslations('devices')
  const tType = useTranslations('devices.type')
  const tStatus = useTranslations('devices.status')
  const { formatDate } = useClinicFormatters()
  const [devices, setDevices] = useState<Device[]>([])
  const [summary, setSummary] = useState<DeviceSummary>({
    total: 0,
    online: 0,
    offline: 0,
    error: 0,
    maintenance: 0,
  })
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const { toast } = useToast()
  const { confirm, ConfirmDialogComponent } = useConfirmDialog()

  // Form state
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState('')
  const [formSerial, setFormSerial] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formIp, setFormIp] = useState('')

  const fetchDevices = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterType !== 'all') params.set('type', filterType)
      if (filterStatus !== 'all') params.set('status', filterStatus)

      const res = await fetch(`/api/devices/status?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setDevices(data.devices || [])
      setSummary(data.summary || { total: 0, online: 0, offline: 0, error: 0, maintenance: 0 })
    } catch {
      toast({ title: t('errorTitle'), description: t('fetchFailed'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [filterType, filterStatus, toast, t])

  useEffect(() => {
    fetchDevices()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDevices, 30000)
    return () => clearInterval(interval)
  }, [fetchDevices])

  const handleRegister = async () => {
    if (!formName || !formType) {
      toast({ title: t('errorTitle'), description: t('nameTypeRequired'), variant: 'destructive' })
      return
    }
    try {
      const res = await fetch('/api/devices/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          type: formType,
          serialNumber: formSerial || undefined,
          location: formLocation || undefined,
          ipAddress: formIp || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      toast({ title: t('successTitle'), description: t('registered') })
      setDialogOpen(false)
      resetForm()
      fetchDevices()
    } catch (err: unknown) {
      toast({
        title: t('errorTitle'),
        description: err instanceof Error ? err.message : t('registerFailed'),
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: t('removeTitle'),
      description: t('removeDesc'),
      confirmLabel: t('removeConfirm'),
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/devices/status?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast({ title: t('successTitle'), description: t('removed') })
      fetchDevices()
    } catch {
      toast({ title: t('errorTitle'), description: t('removeFailed'), variant: 'destructive' })
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await fetch('/api/devices/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (!res.ok) throw new Error()
      fetchDevices()
    } catch {
      toast({ title: t('errorTitle'), description: t('updateFailed'), variant: 'destructive' })
    }
  }

  const resetForm = () => {
    setFormName('')
    setFormType('')
    setFormSerial('')
    setFormLocation('')
    setFormIp('')
  }

  const formatLastPing = (dateStr: string | null) => {
    if (!dateStr) return t('never')
    const diff = Date.now() - new Date(dateStr).getTime()
    if (diff < 60000) return t('justNow')
    if (diff < 3600000) return t('minutesAgo', { m: Math.floor(diff / 60000) })
    if (diff < 86400000) return t('hoursAgo', { h: Math.floor(diff / 3600000) })
    return formatDate(dateStr)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchDevices}>
            <RefreshCw className="h-4 w-4 mr-1" /> {t('refresh')}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> {t('registerDevice')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('registerNewDevice')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>{t('deviceNameLabel')}</Label>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={t('deviceNamePlaceholder')}
                  />
                </div>
                <div>
                  <Label>{t('deviceTypeLabel')}</Label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectType')} />
                    </SelectTrigger>
                    <SelectContent>
                      {DEVICE_TYPE_VALUES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {tType.has(value) ? tType(value) : value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('serialLabel')}</Label>
                  <Input
                    value={formSerial}
                    onChange={(e) => setFormSerial(e.target.value)}
                    placeholder={t('optional')}
                  />
                </div>
                <div>
                  <Label>{t('locationLabel')}</Label>
                  <Input
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder={t('locationPlaceholder')}
                  />
                </div>
                <div>
                  <Label>{t('ipLabel')}</Label>
                  <Input
                    value={formIp}
                    onChange={(e) => setFormIp(e.target.value)}
                    placeholder={t('ipPlaceholder')}
                  />
                </div>
                <Button className="w-full" onClick={handleRegister}>
                  {t('registerDevice')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{summary.total}</p>
                <p className="text-xs text-muted-foreground">{t('totalDevices')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{summary.online}</p>
                <p className="text-xs text-muted-foreground">{t('online')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <WifiOff className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{summary.offline}</p>
                <p className="text-xs text-muted-foreground">{t('offline')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{summary.error}</p>
                <p className="text-xs text-muted-foreground">{t('errors')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{summary.maintenance}</p>
                <p className="text-xs text-muted-foreground">{t('maintenance')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t('filterByType')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allTypes')}</SelectItem>
            {DEVICE_TYPE_VALUES.map((value) => (
              <SelectItem key={value} value={value}>
                {tType.has(value) ? tType(value) : value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t('filterByStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allStatuses')}</SelectItem>
            <SelectItem value="ONLINE">{tStatus('ONLINE')}</SelectItem>
            <SelectItem value="OFFLINE">{tStatus('OFFLINE')}</SelectItem>
            <SelectItem value="ERROR">{tStatus('ERROR')}</SelectItem>
            <SelectItem value="MAINTENANCE">{tStatus('MAINTENANCE')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Device Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" /> {t('registeredDevices')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">{t('loadingDevices')}</p>
          ) : devices.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">{t('noDevices')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colName')}</TableHead>
                  <TableHead>{t('colType')}</TableHead>
                  <TableHead>{t('colLocation')}</TableHead>
                  <TableHead>{t('colStatus')}</TableHead>
                  <TableHead>{t('colLastPing')}</TableHead>
                  <TableHead>{t('colLatestData')}</TableHead>
                  <TableHead className="w-[100px]">{t('colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device) => {
                  const cfg = STATUS_CONFIG[device.status] || STATUS_CONFIG.OFFLINE
                  const StatusIcon = cfg.icon
                  const lastLog = device.dataLogs?.[0]
                  return (
                    <TableRow key={device.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{device.name}</p>
                          {device.serialNumber && (
                            <p className="text-xs text-muted-foreground">
                              {t('serialPrefix', { serial: device.serialNumber })}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {tType.has(device.type) ? tType(device.type) : device.type}
                        </Badge>
                      </TableCell>
                      <TableCell>{device.location || '—'}</TableCell>
                      <TableCell>
                        <Select
                          value={device.status}
                          onValueChange={(val) => handleStatusChange(device.id, val)}
                        >
                          <SelectTrigger className="h-7 w-36">
                            <div className="flex items-center gap-1">
                              <StatusIcon className="h-3.5 w-3.5" />
                              <Badge className={`${cfg.color} text-xs`}>
                                {tStatus.has(device.status)
                                  ? tStatus(device.status)
                                  : device.status}
                              </Badge>
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ONLINE">{tStatus('ONLINE')}</SelectItem>
                            <SelectItem value="OFFLINE">{tStatus('OFFLINE')}</SelectItem>
                            <SelectItem value="MAINTENANCE">{tStatus('MAINTENANCE')}</SelectItem>
                            <SelectItem value="ERROR">{tStatus('ERROR')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatLastPing(device.lastPingAt)}
                      </TableCell>
                      <TableCell>
                        {lastLog ? (
                          <div className="text-xs">
                            <div className="flex items-center gap-1">
                              <Activity className="h-3 w-3 text-blue-500" />
                              <span className="text-muted-foreground">
                                {lastLog.eventType || 'READING'}
                              </span>
                            </div>
                            <p className="text-muted-foreground truncate max-w-[150px]">
                              {JSON.stringify(lastLog.data).slice(0, 50)}...
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">{t('noData')}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500"
                          onClick={() => handleDelete(device.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* API Integration Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('apiTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>{t('apiIntro')}</p>
          <div className="bg-muted/50 p-3 rounded-md font-mono text-xs space-y-1">
            <p>
              <span className="text-green-600 font-semibold">POST</span> /api/devices/register —{' '}
              {t('apiRegister')}
            </p>
            <p>
              <span className="text-blue-600 font-semibold">POST</span> /api/devices/data —{' '}
              {t('apiPush')}
            </p>
            <p>
              <span className="text-purple-600 font-semibold">GET</span> /api/devices/status —{' '}
              {t('apiStatus')}
            </p>
          </div>
          <p>
            {t('payloadExample')}{' '}
            <code className="text-xs bg-muted px-1 rounded">/api/devices/data</code>:
          </p>
          <pre className="bg-muted/50 p-3 rounded-md text-xs overflow-x-auto">
            {`{
  "deviceId": "device_cuid_here",
  "data": {
    "heartRate": 72,
    "bp": "120/80",
    "spo2": 98,
    "temperature": 36.5
  },
  "eventType": "READING"
}`}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
